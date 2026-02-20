import { canTransition, type MessageEnvelope, type MessageState, type Transition } from '@wenyan/core'
import type { SealRecord } from '@wenyan/seal'
import type { ArchiveRepository, DocketItem } from './index'

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>
      all<T = unknown[]>(): Promise<{ results: T } | { results: Record<string, unknown>[] }>
      run(): Promise<unknown>
    }
  }
  exec(query: string): Promise<unknown>
}

interface ArchiveOptions {
  retentionDays?: number
}

function sha256(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export class CloudflareArchiveRepository implements ArchiveRepository {
  private retentionDays: number

  constructor(private readonly db: D1DatabaseLike, options: ArchiveOptions = {}) {
    this.retentionDays = options.retentionDays ?? 3650
  }

  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        seal_chain_json TEXT NOT NULL DEFAULT '[]',
        received_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        from_state TEXT NOT NULL,
        to_state TEXT NOT NULL,
        sequence_no INTEGER NOT NULL,
        actor_id TEXT,
        sealed_at TEXT,
        reason TEXT,
        prev_transition_hash TEXT,
        transition_hash TEXT NOT NULL,
        at TEXT NOT NULL,
        UNIQUE(message_id, sequence_no)
      );
      CREATE TABLE IF NOT EXISTS seals (
        seal_id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL,
        signature TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT
      );
      CREATE TABLE IF NOT EXISTS docket (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        available_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        response_json TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS office_approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        office TEXT NOT NULL,
        approved_at TEXT NOT NULL,
        UNIQUE(message_id, office)
      );
      CREATE TABLE IF NOT EXISTS archive_migrations (
        version INTEGER PRIMARY KEY,
        migration_hash TEXT NOT NULL,
        prev_hash TEXT,
        applied_at TEXT NOT NULL
      );
    `)
  }

  async migrate(): Promise<void> {
    await this.initialize()
    const latest = await this.db
      .prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1')
      .bind()
      .first<{ version: number; migration_hash: string }>()

    if (!latest) {
      const genesisHash = sha256('archive-schema-v1-seal0')
      await this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(1, ?, NULL, ?)')
        .bind(genesisHash, new Date().toISOString())
        .run()
      return
    }

    const v2Hash = sha256(`${latest.migration_hash}:archive-schema-v2-retention-${this.retentionDays}`)
    if (latest.version < 2) {
      await this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(2, ?, ?, ?)')
        .bind(v2Hash, latest.migration_hash, new Date().toISOString())
        .run()
    }
  }

  async appendMessage(message: MessageEnvelope): Promise<void> {
    await this.db
      .prepare('INSERT INTO messages(id, payload_json, seal_chain_json, received_at) VALUES(?, ?, ?, ?)')
      .bind(message.id, JSON.stringify(message), '[]', new Date().toISOString())
      .run()
  }

  async appendTransition(transition: Transition): Promise<void> {
    const current = (await this.snapshotState(transition.messageId)) ?? 'pending'
    if (!canTransition(current, transition.toState) && current !== transition.fromState) {
      throw new Error(`Invalid transition ${current} -> ${transition.toState}`)
    }

    const prev = await this.db
      .prepare('SELECT transition_hash FROM transitions WHERE message_id = ? ORDER BY sequence_no DESC LIMIT 1')
      .bind(transition.messageId)
      .first<{ transition_hash?: string }>()

    const prevTransitionHash = transition.prevTransitionHash ?? prev?.transition_hash ?? 'GENESIS'
    const transitionHash = sha256(
      JSON.stringify({
        messageId: transition.messageId,
        fromState: transition.fromState,
        toState: transition.toState,
        sequenceNo: transition.sequenceNo,
        actorId: transition.actorId ?? null,
        prevTransitionHash,
        at: transition.at,
      }),
    )

    await this.db
      .prepare(
        `INSERT INTO transitions(
          message_id, from_state, to_state, sequence_no, actor_id, sealed_at, reason, prev_transition_hash, transition_hash, at
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        transition.messageId,
        transition.fromState,
        transition.toState,
        transition.sequenceNo,
        transition.actorId ?? null,
        transition.sealedAt ?? null,
        transition.reason ?? null,
        prevTransitionHash,
        transitionHash,
        transition.at,
      )
      .run()
  }

  async appendSeal(seal: SealRecord): Promise<void> {
    await this.db
      .prepare('INSERT INTO seals(seal_id, message_id, stage, prev_hash, hash, signature, created_at, payload_json) VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(
        seal.sealId,
        seal.messageId,
        seal.stage,
        seal.prevHash,
        seal.hash,
        seal.signature,
        seal.createdAt,
        JSON.stringify(seal.payload ?? null),
      )
      .run()

    const seals = await this.getSeals(seal.messageId)
    await this.db.prepare('UPDATE messages SET seal_chain_json = ? WHERE id = ?').bind(JSON.stringify(seals), seal.messageId).run()
  }

  async enqueueDocket(messageId: string): Promise<void> {
    await this.db
      .prepare('INSERT INTO docket(id, message_id, attempts, available_at) VALUES(?, ?, ?, ?)')
      .bind(`${messageId}:${Date.now()}`, messageId, 0, new Date().toISOString())
      .run()
  }

  async dequeueDocket(nowIso: string): Promise<DocketItem | undefined> {
    const row = await this.db
      .prepare('SELECT id, message_id, attempts, available_at FROM docket WHERE available_at <= ? ORDER BY available_at ASC LIMIT 1')
      .bind(nowIso)
      .first<{ id: string; message_id: string; attempts: number; available_at: string }>()

    if (!row) return undefined
    await this.db.prepare('DELETE FROM docket WHERE id = ?').bind(row.id).run()
    return { id: row.id, messageId: row.message_id, attempts: row.attempts, availableAt: row.available_at }
  }

  async snapshotState(messageId: string): Promise<MessageState | undefined> {
    const row = await this.db
      .prepare('SELECT to_state FROM transitions WHERE message_id = ? ORDER BY sequence_no DESC LIMIT 1')
      .bind(messageId)
      .first<{ to_state?: MessageState }>()
    return row?.to_state
  }

  async getMessage(messageId: string): Promise<MessageEnvelope | undefined> {
    const row = await this.db
      .prepare('SELECT payload_json FROM messages WHERE id = ?')
      .bind(messageId)
      .first<{ payload_json?: string }>()
    if (!row?.payload_json) return undefined
    return JSON.parse(row.payload_json) as MessageEnvelope
  }

  async getTransitions(messageId: string): Promise<Transition[]> {
    const rows = await this.db
      .prepare(
        `SELECT message_id, from_state, to_state, sequence_no, actor_id, sealed_at, reason, prev_transition_hash, at
         FROM transitions WHERE message_id = ? ORDER BY sequence_no ASC`,
      )
      .bind(messageId)
      .all()

    return ((rows as { results: Array<Record<string, unknown>> }).results).map((r) => ({
      messageId: String(r.message_id),
      fromState: r.from_state as Transition['fromState'],
      toState: r.to_state as Transition['toState'],
      sequenceNo: Number(r.sequence_no),
      actorId: r.actor_id ? String(r.actor_id) : undefined,
      sealedAt: r.sealed_at ? String(r.sealed_at) : undefined,
      reason: r.reason ? String(r.reason) : undefined,
      prevTransitionHash: r.prev_transition_hash ? String(r.prev_transition_hash) : undefined,
      at: String(r.at),
    }))
  }

  async getSeals(messageId: string): Promise<SealRecord[]> {
    const rows = await this.db
      .prepare('SELECT seal_id, message_id, stage, prev_hash, hash, signature, created_at, payload_json FROM seals WHERE message_id = ? ORDER BY created_at ASC')
      .bind(messageId)
      .all()

    return ((rows as { results: Array<Record<string, unknown>> }).results).map((r) => ({
      sealId: String(r.seal_id),
      messageId: String(r.message_id),
      stage: r.stage as SealRecord['stage'],
      prevHash: String(r.prev_hash),
      hash: String(r.hash),
      signature: String(r.signature),
      createdAt: String(r.created_at),
      ...(r.payload_json ? { payload: JSON.parse(String(r.payload_json)) as Record<string, unknown> } : {}),
    }))
  }

  async getIdempotency(key: string, nowIso: string): Promise<{ key: string; responseJson: string; expiresAt: string } | undefined> {
    const row = await this.db
      .prepare('SELECT key, response_json, expires_at FROM idempotency_keys WHERE key = ?')
      .bind(key)
      .first<Record<string, unknown>>()
    if (!row || String(row.expires_at) < nowIso) return undefined
    return { key: String(row.key), responseJson: String(row.response_json), expiresAt: String(row.expires_at) }
  }

  async putIdempotency(key: string, responseJson: string, expiresAt: string): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO idempotency_keys(key, response_json, expires_at, created_at) VALUES(?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET response_json = excluded.response_json, expires_at = excluded.expires_at',
      )
      .bind(key, responseJson, expiresAt, new Date().toISOString())
      .run()
  }

  async addOfficeApproval(messageId: string, office: string): Promise<number> {
    await this.db
      .prepare('INSERT INTO office_approvals(message_id, office, approved_at) VALUES(?, ?, ?) ON CONFLICT(message_id, office) DO NOTHING')
      .bind(messageId, office, new Date().toISOString())
      .run()

    const row = await this.db.prepare('SELECT COUNT(*) as c FROM office_approvals WHERE message_id = ?').bind(messageId).first<{ c: number }>()
    return row?.c ?? 0
  }

  async getOfficeApprovals(messageId: string): Promise<string[]> {
    const rows = await this.db
      .prepare('SELECT office FROM office_approvals WHERE message_id = ? ORDER BY office ASC')
      .bind(messageId)
      .all()
    return ((rows as { results: Array<Record<string, unknown>> }).results).map((r) => String(r.office))
  }

  async stateAt(messageId: string, timestampIso: string): Promise<MessageState | undefined> {
    const row = await this.db
      .prepare(
        `SELECT to_state
         FROM transitions
         WHERE message_id = ? AND sealed_at <= ?
         ORDER BY sequence_no DESC
         LIMIT 1`,
      )
      .bind(messageId, timestampIso)
      .first<{ to_state?: MessageState }>()

    return row?.to_state
  }

  async getActiveGenreSchema(targetGenre: string): Promise<Record<string, unknown> | undefined> {
    const row = await this.db
      .prepare(
        `SELECT payload_json
         FROM messages
         WHERE json_extract(payload_json, '$.genre') = 'ti_definition'
           AND json_extract(payload_json, '$.payload.target_genre') = ?
           AND json_extract(payload_json, '$.payload.superseded_by') IS NULL
         ORDER BY received_at DESC
         LIMIT 1`,
      )
      .bind(targetGenre)
      .first<{ payload_json?: string }>()
    if (!row?.payload_json) return undefined
    const envelope = JSON.parse(row.payload_json) as MessageEnvelope
    const payload = envelope.payload as Record<string, unknown>
    if (!payload || typeof payload.schema !== 'object' || payload.schema === null) return undefined
    return payload.schema as Record<string, unknown>
  }
}
