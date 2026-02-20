import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { canTransition, type MessageEnvelope, type MessageState, type Transition } from '@wenyan/core'
import type { SealRecord } from '@wenyan/seal'
import type { ArchiveRepository, DocketItem } from './index'

interface ArchiveOptions {
  retentionDays?: number
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export class SqliteArchiveRepository implements ArchiveRepository {
  private db: DatabaseSync
  private retentionDays: number

  constructor(path: string, options: ArchiveOptions = {}) {
    this.db = new DatabaseSync(path)
    this.retentionDays = options.retentionDays ?? 3650
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA foreign_keys = ON;')
  }

  initialize(): void {
    this.db.exec(`
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
        UNIQUE(message_id, sequence_no),
        FOREIGN KEY(message_id) REFERENCES messages(id)
      );

      CREATE TABLE IF NOT EXISTS seals (
        seal_id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL,
        signature TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload_json TEXT,
        FOREIGN KEY(message_id) REFERENCES messages(id)
      );

      CREATE TABLE IF NOT EXISTS docket (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        available_at TEXT NOT NULL,
        FOREIGN KEY(message_id) REFERENCES messages(id)
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
        UNIQUE(message_id, office),
        FOREIGN KEY(message_id) REFERENCES messages(id)
      );

      CREATE TABLE IF NOT EXISTS archive_migrations (
        version INTEGER PRIMARY KEY,
        migration_hash TEXT NOT NULL,
        prev_hash TEXT,
        applied_at TEXT NOT NULL
      );
    `)
  }

  migrate(): void {
    this.initialize()
    const latest = this.db.prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1').get() as
      | { version: number; migration_hash: string }
      | undefined

    if (!latest) {
      const genesisHash = sha256('archive-schema-v1-seal0')
      this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(1, ?, NULL, ?)')
        .run(genesisHash, new Date().toISOString())
      return
    }

    const v2Hash = sha256(`${latest.migration_hash}:archive-schema-v2-retention-${this.retentionDays}`)
    if (latest.version < 2) {
      this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(2, ?, ?, ?)')
        .run(v2Hash, latest.migration_hash, new Date().toISOString())
    }
  }

  appendMessage(message: MessageEnvelope): void {
    this.db
      .prepare('INSERT INTO messages(id, payload_json, seal_chain_json, received_at) VALUES(?, ?, ?, ?)')
      .run(message.id, JSON.stringify(message), '[]', new Date().toISOString())
  }

  appendTransition(transition: Transition): void {
    const current = this.snapshotState(transition.messageId) ?? 'pending'
    if (!canTransition(current, transition.toState) && current !== transition.fromState) {
      throw new Error(`Invalid transition ${current} -> ${transition.toState}`)
    }

    const prev = this.db
      .prepare('SELECT transition_hash FROM transitions WHERE message_id = ? ORDER BY sequence_no DESC LIMIT 1')
      .get(transition.messageId) as { transition_hash?: string } | undefined

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

    this.db
      .prepare(
        `INSERT INTO transitions(
          message_id, from_state, to_state, sequence_no, actor_id, sealed_at, reason, prev_transition_hash, transition_hash, at
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
  }

  appendSeal(seal: SealRecord): void {
    this.db
      .prepare(
        'INSERT INTO seals(seal_id, message_id, stage, prev_hash, hash, signature, created_at, payload_json) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        seal.sealId,
        seal.messageId,
        seal.stage,
        seal.prevHash,
        seal.hash,
        seal.signature,
        seal.createdAt,
        JSON.stringify(seal.payload ?? null),
      )

    const seals = this.getSeals(seal.messageId)
    this.db
      .prepare('UPDATE messages SET seal_chain_json = ? WHERE id = ?')
      .run(JSON.stringify(seals), seal.messageId)
  }

  enqueueDocket(messageId: string): void {
    this.db
      .prepare('INSERT INTO docket(id, message_id, attempts, available_at) VALUES(?, ?, ?, ?)')
      .run(`${messageId}:${Date.now()}`, messageId, 0, new Date().toISOString())
  }

  dequeueDocket(nowIso: string): DocketItem | undefined {
    const row = this.db
      .prepare('SELECT id, message_id, attempts, available_at FROM docket WHERE available_at <= ? ORDER BY available_at ASC LIMIT 1')
      .get(nowIso) as { id: string; message_id: string; attempts: number; available_at: string } | undefined

    if (!row) {
      return undefined
    }

    this.db.prepare('DELETE FROM docket WHERE id = ?').run(row.id)
    return {
      id: row.id,
      messageId: row.message_id,
      attempts: row.attempts,
      availableAt: row.available_at,
    }
  }

  snapshotState(messageId: string): MessageState | undefined {
    const row = this.db
      .prepare('SELECT to_state FROM transitions WHERE message_id = ? ORDER BY sequence_no DESC LIMIT 1')
      .get(messageId) as { to_state?: MessageState } | undefined

    return row?.to_state
  }

  getMessage(messageId: string): MessageEnvelope | undefined {
    const row = this.db
      .prepare('SELECT payload_json FROM messages WHERE id = ?')
      .get(messageId) as { payload_json?: string } | undefined
    if (!row?.payload_json) {
      return undefined
    }
    return JSON.parse(row.payload_json) as MessageEnvelope
  }

  getTransitions(messageId: string): Transition[] {
    const rows = this.db
      .prepare(
        `SELECT message_id, from_state, to_state, sequence_no, actor_id, sealed_at, reason, prev_transition_hash, at
         FROM transitions WHERE message_id = ? ORDER BY sequence_no ASC`,
      )
      .all(messageId) as Array<{
      message_id: string
      from_state: Transition['fromState']
      to_state: Transition['toState']
      sequence_no: number
      actor_id: string | null
      sealed_at: string | null
      reason: string | null
      prev_transition_hash: string | null
      at: string
    }>

    return rows.map((r) => ({
      messageId: r.message_id,
      fromState: r.from_state,
      toState: r.to_state,
      sequenceNo: r.sequence_no,
      actorId: r.actor_id ?? undefined,
      sealedAt: r.sealed_at ?? undefined,
      reason: r.reason ?? undefined,
      prevTransitionHash: r.prev_transition_hash ?? undefined,
      at: r.at,
    }))
  }

  getSeals(messageId: string): SealRecord[] {
    const rows = this.db
      .prepare('SELECT seal_id, message_id, stage, prev_hash, hash, signature, created_at, payload_json FROM seals WHERE message_id = ? ORDER BY created_at ASC')
      .all(messageId) as Array<{
      seal_id: string
      message_id: string
      stage: SealRecord['stage']
      prev_hash: string
      hash: string
      signature: string
      created_at: string
      payload_json: string | null
    }>

    return rows.map((r) => ({
      sealId: r.seal_id,
      messageId: r.message_id,
      stage: r.stage,
      prevHash: r.prev_hash,
      hash: r.hash,
      signature: r.signature,
      createdAt: r.created_at,
      ...(r.payload_json ? { payload: JSON.parse(r.payload_json) as Record<string, unknown> } : {}),
    }))
  }

  getIdempotency(key: string, nowIso: string): { key: string; responseJson: string; expiresAt: string } | undefined {
    const row = this.db
      .prepare('SELECT key, response_json, expires_at FROM idempotency_keys WHERE key = ?')
      .get(key) as { key: string; response_json: string; expires_at: string } | undefined
    if (!row) return undefined
    if (row.expires_at < nowIso) return undefined
    return { key: row.key, responseJson: row.response_json, expiresAt: row.expires_at }
  }

  putIdempotency(key: string, responseJson: string, expiresAt: string): void {
    this.db
      .prepare(
        'INSERT INTO idempotency_keys(key, response_json, expires_at, created_at) VALUES(?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET response_json = excluded.response_json, expires_at = excluded.expires_at',
      )
      .run(key, responseJson, expiresAt, new Date().toISOString())
  }

  addOfficeApproval(messageId: string, office: string): number {
    this.db
      .prepare('INSERT INTO office_approvals(message_id, office, approved_at) VALUES(?, ?, ?) ON CONFLICT(message_id, office) DO NOTHING')
      .run(messageId, office, new Date().toISOString())
    const row = this.db
      .prepare('SELECT COUNT(*) as c FROM office_approvals WHERE message_id = ?')
      .get(messageId) as { c: number }
    return row.c
  }

  getOfficeApprovals(messageId: string): string[] {
    const rows = this.db
      .prepare('SELECT office FROM office_approvals WHERE message_id = ? ORDER BY office ASC')
      .all(messageId) as Array<{ office: string }>
    return rows.map((r) => r.office)
  }

  close(): void {
    this.db.close()
  }
}
