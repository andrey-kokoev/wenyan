import {
  canTransition,
  EdictLawTypeValues,
  type EdictLawType,
  type MessageEnvelope,
  type MessageState,
  type ResolvedLaw,
  type Transition,
} from '@wenyan/core'
import type { SealRecord } from '@wenyan/seal'
import type {
  ArchiveRepository,
  BridgeOutboundQueueItem,
  ConstitutionalDocumentRef,
  DocketItem,
  ForeignRejectedRecord,
  ForeignSyncStateRecord,
  GossipLogEntry,
  MerkleProof,
  TiDefinitionRecord,
} from './index'
import { merkleRootForLeaves } from './merkle-dag'

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
        genre TEXT,
        payload_json TEXT NOT NULL,
        seal_chain_json TEXT NOT NULL DEFAULT '[]',
        origin_node_id TEXT,
        vector_clock_json TEXT,
        content_hash TEXT,
        constitutional INTEGER NOT NULL DEFAULT 0,
        superseded_by TEXT,
        received_at TEXT NOT NULL,
        submitted_at TEXT,
        archived_at TEXT
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

      CREATE TABLE IF NOT EXISTS edict_index (
        message_id TEXT PRIMARY KEY,
        law_type TEXT NOT NULL,
        version TEXT NOT NULL,
        content_json TEXT NOT NULL,
        precedence INTEGER NOT NULL,
        effective_date TEXT NOT NULL,
        superseded_edict_id TEXT,
        sealed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ti_definition_index (
        message_id TEXT PRIMARY KEY,
        target_genre TEXT NOT NULL,
        version TEXT NOT NULL,
        schema_json TEXT NOT NULL,
        superseded_by TEXT,
        sealed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS archive_state (
        scope TEXT PRIMARY KEY,
        merkle_root TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content_store (
        hash TEXT PRIMARY KEY,
        payload_blob BLOB NOT NULL,
        ref_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS gossip_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        peer_node_id TEXT NOT NULL,
        seal_seq INTEGER NOT NULL,
        received_at TEXT NOT NULL,
        kind TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS foreign_sync_state (
        document_id TEXT PRIMARY KEY,
        adapter_id TEXT NOT NULL,
        adapter_protocol TEXT NOT NULL,
        foreign_id TEXT NOT NULL,
        foreign_vector_clock_json TEXT,
        last_sync_at TEXT NOT NULL,
        conflict_status TEXT NOT NULL,
        last_error TEXT
      );

      CREATE TABLE IF NOT EXISTS foreign_rejected (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adapter_id TEXT NOT NULL,
        foreign_id TEXT,
        reason_code TEXT NOT NULL,
        reason_detail TEXT,
        payload_json TEXT,
        received_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bridge_outbound_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adapter_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TEXT NOT NULL,
        last_error TEXT,
        status TEXT NOT NULL DEFAULT 'queued'
      );
    `)

    await this.tryExec('ALTER TABLE messages ADD COLUMN genre TEXT')
    await this.tryExec('ALTER TABLE messages ADD COLUMN origin_node_id TEXT')
    await this.tryExec('ALTER TABLE messages ADD COLUMN vector_clock_json TEXT')
    await this.tryExec('ALTER TABLE messages ADD COLUMN content_hash TEXT')
    await this.tryExec('ALTER TABLE messages ADD COLUMN constitutional INTEGER NOT NULL DEFAULT 0')
    await this.tryExec('ALTER TABLE messages ADD COLUMN superseded_by TEXT')
    await this.tryExec('ALTER TABLE messages ADD COLUMN submitted_at TEXT')
    await this.tryExec('ALTER TABLE messages ADD COLUMN archived_at TEXT')

    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_genre ON messages(genre);
      CREATE INDEX IF NOT EXISTS idx_messages_content_hash ON messages(content_hash);
      CREATE INDEX IF NOT EXISTS idx_constitutional_genre ON messages(constitutional, genre, archived_at);
      CREATE INDEX IF NOT EXISTS idx_edict_lookup ON edict_index(law_type, effective_date DESC, precedence DESC, sealed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_edict_supersession ON edict_index(superseded_edict_id);
      CREATE INDEX IF NOT EXISTS idx_ti_lookup ON ti_definition_index(target_genre, sealed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_gossip_peer_received ON gossip_log(peer_node_id, received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_foreign_sync_adapter_foreign_id ON foreign_sync_state(adapter_id, foreign_id);
      CREATE INDEX IF NOT EXISTS idx_foreign_rejected_adapter_time ON foreign_rejected(adapter_id, received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bridge_outbound_available_status ON bridge_outbound_queue(status, available_at ASC);
      CREATE INDEX IF NOT EXISTS idx_bridge_outbound_message ON bridge_outbound_queue(message_id);
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

    const latestPostV2 = await this.db
      .prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1')
      .bind()
      .first<{ version: number; migration_hash: string }>()
    if (!latestPostV2) return

    const v3Hash = sha256(`${latestPostV2.migration_hash}:archive-schema-v3-law-indexes`)
    if (latestPostV2.version < 3) {
      await this.db.exec(`
        UPDATE messages
        SET genre = COALESCE(genre, json_extract(payload_json, '$.genre'));

        UPDATE messages
        SET submitted_at = COALESCE(submitted_at, json_extract(payload_json, '$.submittedAt'), received_at);

        UPDATE messages
        SET archived_at = (
          SELECT MAX(COALESCE(sealed_at, at))
          FROM transitions
          WHERE transitions.message_id = messages.id
            AND transitions.to_state = 'archived'
        )
        WHERE archived_at IS NULL;
      `)

      await this.db.exec(`
        INSERT INTO edict_index(message_id, law_type, version, content_json, precedence, effective_date, superseded_edict_id, sealed_at)
        SELECT
          id,
          json_extract(payload_json, '$.payload.law_type'),
          COALESCE(json_extract(payload_json, '$.payload.version'), '1.0.0'),
          COALESCE(json_extract(payload_json, '$.payload.content'), '{}'),
          COALESCE(json_extract(payload_json, '$.payload.precedence'), 0),
          COALESCE(json_extract(payload_json, '$.payload.effective_date'), submitted_at, received_at),
          json_extract(payload_json, '$.payload.superseded_edict_id'),
          archived_at
        FROM messages
        WHERE genre = 'edict'
          AND archived_at IS NOT NULL
        ON CONFLICT(message_id) DO UPDATE SET
          law_type = excluded.law_type,
          version = excluded.version,
          content_json = excluded.content_json,
          precedence = excluded.precedence,
          effective_date = excluded.effective_date,
          superseded_edict_id = excluded.superseded_edict_id,
          sealed_at = excluded.sealed_at;
      `)

      await this.db.exec(`
        INSERT INTO ti_definition_index(message_id, target_genre, version, schema_json, superseded_by, sealed_at)
        SELECT
          id,
          json_extract(payload_json, '$.payload.target_genre'),
          COALESCE(json_extract(payload_json, '$.payload.version'), '1.0.0'),
          COALESCE(json_extract(payload_json, '$.payload.schema'), '{}'),
          json_extract(payload_json, '$.payload.superseded_by'),
          archived_at
        FROM messages
        WHERE genre = 'ti_definition'
          AND archived_at IS NOT NULL
        ON CONFLICT(message_id) DO UPDATE SET
          target_genre = excluded.target_genre,
          version = excluded.version,
          schema_json = excluded.schema_json,
          superseded_by = excluded.superseded_by,
          sealed_at = excluded.sealed_at;
      `)

      await this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(3, ?, ?, ?)')
        .bind(v3Hash, latestPostV2.migration_hash, new Date().toISOString())
        .run()
    }

    const latestPostV3 = await this.db
      .prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1')
      .bind()
      .first<{ version: number; migration_hash: string }>()
    if (!latestPostV3) return

    const v4Hash = sha256(`${latestPostV3.migration_hash}:archive-schema-v4-constitutional-columns`)
    if (latestPostV3.version < 4) {
      await this.db.exec(`
        UPDATE messages
        SET constitutional = CASE
          WHEN genre = 'ti_definition' THEN 1
          WHEN COALESCE(json_extract(payload_json, '$.metadata.constitutional'), 0) IN (1, true, 'true') THEN 1
          ELSE constitutional
        END;

        UPDATE messages
        SET superseded_by = COALESCE(
          superseded_by,
          json_extract(payload_json, '$.payload.superseded_by'),
          json_extract(payload_json, '$.payload.superseded_edict_id')
        );
      `)

      await this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(4, ?, ?, ?)')
        .bind(v4Hash, latestPostV3.migration_hash, new Date().toISOString())
        .run()
    }

    const latestPostV4 = await this.db
      .prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1')
      .bind()
      .first<{ version: number; migration_hash: string }>()
    if (!latestPostV4) return
    const v5Hash = sha256(`${latestPostV4.migration_hash}:archive-schema-v5-consort`)
    if (latestPostV4.version < 5) {
      await this.db.exec(`
        UPDATE messages
        SET origin_node_id = COALESCE(origin_node_id, json_extract(payload_json, '$.metadata.consort.origin_node_id'), 'local-node');
        UPDATE messages
        SET vector_clock_json = COALESCE(vector_clock_json, json_object(COALESCE(origin_node_id, 'local-node'), 1));
        UPDATE messages
        SET content_hash = COALESCE(content_hash, lower(hex(randomblob(16))));
      `)
      await this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(5, ?, ?, ?)')
        .bind(v5Hash, latestPostV4.migration_hash, new Date().toISOString())
        .run()
    }

    const latestPostV5 = await this.db
      .prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1')
      .bind()
      .first<{ version: number; migration_hash: string }>()
    if (!latestPostV5) return
    const v6Hash = sha256(`${latestPostV5.migration_hash}:archive-schema-v6-bridge`)
    if (latestPostV5.version < 6) {
      await this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(6, ?, ?, ?)')
        .bind(v6Hash, latestPostV5.migration_hash, new Date().toISOString())
        .run()
    }
  }

  async appendMessage(message: MessageEnvelope): Promise<void> {
    const payload = message.payload as Record<string, unknown>
    const metadata = message.metadata as Record<string, unknown>
    const constitutional = message.genre === 'ti_definition' || metadata.constitutional === true ? 1 : 0
    const supersededBy =
      (typeof payload.superseded_by === 'string' ? payload.superseded_by : undefined) ??
      (typeof payload.superseded_edict_id === 'string' ? payload.superseded_edict_id : undefined) ??
      null
    const consort = (metadata.consort as Record<string, unknown> | undefined) ?? {}
    const originNodeId = typeof consort.origin_node_id === 'string' ? consort.origin_node_id : 'local-node'
    const vectorClock = consort.vector_clock && typeof consort.vector_clock === 'object' ? consort.vector_clock : { [originNodeId]: 1 }
    const contentHash = sha256(JSON.stringify(message.payload))
    await this.db
      .prepare('INSERT INTO messages(id, genre, payload_json, seal_chain_json, origin_node_id, vector_clock_json, content_hash, constitutional, superseded_by, received_at, submitted_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(
        message.id,
        message.genre,
        JSON.stringify(message),
        '[]',
        originNodeId,
        JSON.stringify(vectorClock),
        contentHash,
        constitutional,
        supersededBy,
        new Date().toISOString(),
        message.submittedAt,
      )
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

    if (transition.toState === 'archived') {
      const sealedAt = transition.sealedAt ?? transition.at
      await this.db.prepare('UPDATE messages SET archived_at = ? WHERE id = ?').bind(sealedAt, transition.messageId).run()
      await this.indexArchivedMessage(transition.messageId, sealedAt)
    }
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
    const def = await this.getCurrentTiDefinition(targetGenre)
    return def?.schema
  }

  async getCurrentTiDefinition(genre: string, atIso = new Date().toISOString()): Promise<TiDefinitionRecord | undefined> {
    const row = await this.db
      .prepare(
        `SELECT t.message_id, t.target_genre, t.version, t.schema_json, t.sealed_at
         FROM ti_definition_index t
         WHERE t.target_genre = ?
           AND t.sealed_at <= ?
           AND NOT EXISTS (
            SELECT 1 FROM ti_definition_index s
            WHERE s.target_genre = t.target_genre
              AND s.superseded_by = t.message_id
              AND s.sealed_at <= ?
           )
         ORDER BY t.sealed_at DESC, t.message_id DESC
         LIMIT 1`,
      )
      .bind(genre, atIso, atIso)
      .first<{ message_id: string; target_genre: string; version: string; schema_json: string; sealed_at: string }>()
    if (!row) return undefined
    return {
      messageId: row.message_id,
      targetGenre: row.target_genre,
      version: row.version,
      schema: JSON.parse(row.schema_json) as Record<string, unknown>,
      sealedAt: row.sealed_at,
    }
  }

  async getCurrentLaw(lawType: EdictLawType, atIso: string): Promise<ResolvedLaw | undefined> {
    const rows = await this.db
      .prepare(
        `SELECT
           e.message_id,
           e.law_type,
           e.version,
           e.content_json,
           e.precedence,
           e.effective_date,
           e.sealed_at
         FROM edict_index e
         WHERE e.law_type = ?
           AND e.effective_date <= ?
           AND e.sealed_at IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM edict_index s
             WHERE s.law_type = e.law_type
               AND s.superseded_edict_id = e.message_id
               AND s.effective_date <= ?
               AND s.sealed_at IS NOT NULL
           )
         ORDER BY e.precedence DESC, e.effective_date DESC, e.sealed_at DESC, e.message_id DESC
         LIMIT 2`,
      )
      .bind(lawType, atIso, atIso)
      .all<Array<Record<string, unknown>>>()

    const resultRows = (rows as { results: Array<Record<string, unknown>> }).results
    if (resultRows.length === 0) return undefined
    if (resultRows.length > 1) {
      const a = resultRows[0]
      const b = resultRows[1]
      if (
        Number(a.precedence) === Number(b.precedence) &&
        String(a.effective_date) === String(b.effective_date) &&
        String(a.sealed_at) === String(b.sealed_at)
      ) {
        throw new Error('ambiguous-law')
      }
    }

    const top = resultRows[0]
    return {
      messageId: String(top.message_id),
      lawType: String(top.law_type) as EdictLawType,
      version: String(top.version),
      content: JSON.parse(String(top.content_json)) as Record<string, unknown>,
      precedence: Number(top.precedence),
      effectiveDate: String(top.effective_date),
      sealedAt: String(top.sealed_at),
    }
  }

  async getLawSet(atIso: string): Promise<Record<EdictLawType, ResolvedLaw | undefined>> {
    const out = {} as Record<EdictLawType, ResolvedLaw | undefined>
    for (const lawType of EdictLawTypeValues) {
      out[lawType] = await this.getCurrentLaw(lawType, atIso)
    }
    return out
  }

  async getConstitutionalDocuments(): Promise<ConstitutionalDocumentRef[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, archived_at
         FROM messages
         WHERE constitutional = 1
           AND archived_at IS NOT NULL
         ORDER BY archived_at ASC, id ASC`,
      )
      .bind()
      .all<Array<Record<string, unknown>>>()
    return (rows as { results: Array<Record<string, unknown>> }).results.map((r) => ({
      id: String(r.id),
      archivedAt: String(r.archived_at),
    }))
  }

  async getMerkleRoot(scope: 'all' | 'constitutional' | 'legislative' = 'all'): Promise<string> {
    let where = 'archived_at IS NOT NULL'
    if (scope === 'constitutional') where += ' AND constitutional = 1'
    if (scope === 'legislative') where += " AND genre = 'edict'"
    const rows = await this.db
      .prepare(`SELECT COALESCE(content_hash, id) AS h FROM messages WHERE ${where} ORDER BY archived_at ASC, id ASC`)
      .bind()
      .all<Array<Record<string, unknown>>>()
    const root = merkleRootForLeaves((rows as { results: Array<Record<string, unknown>> }).results.map((r) => String(r.h)))
    await this.db
      .prepare(
        `INSERT INTO archive_state(scope, merkle_root, updated_at) VALUES(?, ?, ?)
         ON CONFLICT(scope) DO UPDATE SET merkle_root = excluded.merkle_root, updated_at = excluded.updated_at`,
      )
      .bind(scope, root, new Date().toISOString())
      .run()
    return root
  }

  async getMerkleProof(messageId: string): Promise<MerkleProof | undefined> {
    const row = await this.db
      .prepare('SELECT COALESCE(content_hash, id) AS h FROM messages WHERE id = ?')
      .bind(messageId)
      .first<{ h?: string }>()
    if (!row?.h) return undefined
    return { messageId, leafHash: row.h, rootHash: await this.getMerkleRoot('all'), path: [] }
  }

  async getSyncRange(fromCursor: string, limit: number): Promise<Transition[]> {
    const cursor = Number(fromCursor) || 0
    const rows = await this.db
      .prepare(
        `SELECT id, message_id, from_state, to_state, sequence_no, actor_id, sealed_at, reason, prev_transition_hash, at
         FROM transitions
         WHERE id > ?
         ORDER BY id ASC
         LIMIT ?`,
      )
      .bind(cursor, limit)
      .all<Array<Record<string, unknown>>>()
    return (rows as { results: Array<Record<string, unknown>> }).results.map((r) => ({
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

  async upsertContentBlob(hash: string, payload: Uint8Array | string): Promise<void> {
    const raw = typeof payload === 'string' ? Buffer.from(payload) : Buffer.from(payload)
    await this.db
      .prepare(
        `INSERT INTO content_store(hash, payload_blob, ref_count) VALUES(?, ?, 1)
         ON CONFLICT(hash) DO UPDATE SET ref_count = ref_count + 1`,
      )
      .bind(hash, raw)
      .run()
  }

  async getContentBlob(hash: string): Promise<Uint8Array | undefined> {
    const row = await this.db
      .prepare('SELECT payload_blob FROM content_store WHERE hash = ?')
      .bind(hash)
      .first<{ payload_blob?: ArrayBuffer | Uint8Array }>()
    if (!row?.payload_blob) return undefined
    return new Uint8Array(row.payload_blob as ArrayBuffer)
  }

  async appendGossipLog(entry: GossipLogEntry): Promise<void> {
    await this.db
      .prepare('INSERT INTO gossip_log(message_id, peer_node_id, seal_seq, received_at, kind) VALUES(?, ?, ?, ?, ?)')
      .bind(entry.messageId, entry.peerNodeId, entry.sealSeq, entry.receivedAt, entry.kind)
      .run()
  }

  async appendForeignRejected(entry: ForeignRejectedRecord): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO foreign_rejected(adapter_id, foreign_id, reason_code, reason_detail, payload_json, received_at) VALUES(?, ?, ?, ?, ?, ?)',
      )
      .bind(
        entry.adapterId,
        entry.foreignId ?? null,
        entry.reasonCode,
        entry.reasonDetail ?? null,
        entry.payloadJson ?? null,
        entry.receivedAt,
      )
      .run()
  }

  async upsertForeignSyncState(entry: ForeignSyncStateRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO foreign_sync_state(document_id, adapter_id, adapter_protocol, foreign_id, foreign_vector_clock_json, last_sync_at, conflict_status, last_error)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(document_id) DO UPDATE SET
           adapter_id = excluded.adapter_id,
           adapter_protocol = excluded.adapter_protocol,
           foreign_id = excluded.foreign_id,
           foreign_vector_clock_json = excluded.foreign_vector_clock_json,
           last_sync_at = excluded.last_sync_at,
           conflict_status = excluded.conflict_status,
           last_error = excluded.last_error`,
      )
      .bind(
        entry.documentId,
        entry.adapterId,
        entry.adapterProtocol,
        entry.foreignId,
        entry.foreignVectorClockJson ?? null,
        entry.lastSyncAt,
        entry.conflictStatus,
        entry.lastError ?? null,
      )
      .run()
  }

  async getForeignSyncState(documentId: string): Promise<ForeignSyncStateRecord | undefined> {
    const row = await this.db
      .prepare(
        `SELECT document_id, adapter_id, adapter_protocol, foreign_id, foreign_vector_clock_json, last_sync_at, conflict_status, last_error
         FROM foreign_sync_state WHERE document_id = ?`,
      )
      .bind(documentId)
      .first<{
        document_id: string
        adapter_id: string
        adapter_protocol: 'nats' | 'kafka' | 'mqtt'
        foreign_id: string
        foreign_vector_clock_json: string | null
        last_sync_at: string
        conflict_status: 'resolved' | 'pending' | 'schism'
        last_error: string | null
      }>()
    if (!row) return undefined
    return {
      documentId: row.document_id,
      adapterId: row.adapter_id,
      adapterProtocol: row.adapter_protocol,
      foreignId: row.foreign_id,
      foreignVectorClockJson: row.foreign_vector_clock_json ?? undefined,
      lastSyncAt: row.last_sync_at,
      conflictStatus: row.conflict_status,
      lastError: row.last_error ?? undefined,
    }
  }

  async enqueueBridgeOutbound(adapterId: string, messageId: string, availableAt: string): Promise<void> {
    await this.db
      .prepare('INSERT INTO bridge_outbound_queue(adapter_id, message_id, attempts, available_at, status) VALUES(?, ?, 0, ?, ?)')
      .bind(adapterId, messageId, availableAt, 'queued')
      .run()
  }

  async dequeueBridgeOutbound(nowIso: string, limit: number): Promise<BridgeOutboundQueueItem[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, adapter_id, message_id, attempts, available_at, last_error, status
         FROM bridge_outbound_queue
         WHERE available_at <= ? AND status IN ('queued', 'failed')
         ORDER BY available_at ASC, id ASC
         LIMIT ?`,
      )
      .bind(nowIso, limit)
      .all<Array<Record<string, unknown>>>()
    return (rows as { results: Array<Record<string, unknown>> }).results.map((r) => ({
      id: Number(r.id),
      adapterId: String(r.adapter_id),
      messageId: String(r.message_id),
      attempts: Number(r.attempts),
      availableAt: String(r.available_at),
      lastError: r.last_error ? String(r.last_error) : undefined,
      status: String(r.status) as BridgeOutboundQueueItem['status'],
    }))
  }

  async markBridgeOutboundResult(id: number, status: BridgeOutboundQueueItem['status'], lastError?: string): Promise<void> {
    if (status === 'sent') {
      await this.db.prepare('DELETE FROM bridge_outbound_queue WHERE id = ?').bind(id).run()
      return
    }
    await this.db
      .prepare(
        `UPDATE bridge_outbound_queue
         SET status = ?, attempts = attempts + 1, last_error = ?, available_at = ?
         WHERE id = ?`,
      )
      .bind(status, lastError ?? null, new Date().toISOString(), id)
      .run()
  }

  private async indexArchivedMessage(messageId: string, sealedAt: string): Promise<void> {
    const message = await this.getMessage(messageId)
    if (!message) return
    const payload = message.payload as Record<string, unknown>
    const metadata = message.metadata as Record<string, unknown>
    const constitutional = message.genre === 'ti_definition' || metadata.constitutional === true ? 1 : 0
    const supersededBy =
      (typeof payload.superseded_by === 'string' ? payload.superseded_by : undefined) ??
      (typeof payload.superseded_edict_id === 'string' ? payload.superseded_edict_id : undefined) ??
      null
    await this.db
      .prepare('UPDATE messages SET constitutional = ?, superseded_by = ? WHERE id = ?')
      .bind(constitutional, supersededBy, messageId)
      .run()

    if (message.genre === 'edict') {
      const lawType = payload.law_type
      if (typeof lawType !== 'string') return
      await this.db
        .prepare(
          `INSERT INTO edict_index(message_id, law_type, version, content_json, precedence, effective_date, superseded_edict_id, sealed_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(message_id) DO UPDATE SET
             law_type = excluded.law_type,
             version = excluded.version,
             content_json = excluded.content_json,
             precedence = excluded.precedence,
             effective_date = excluded.effective_date,
             superseded_edict_id = excluded.superseded_edict_id,
             sealed_at = excluded.sealed_at`,
        )
        .bind(
          messageId,
          lawType,
          String(payload.version ?? '1.0.0'),
          JSON.stringify((payload.content ?? {}) as Record<string, unknown>),
          Number(payload.precedence ?? 0),
          String(payload.effective_date ?? message.submittedAt),
          payload.superseded_edict_id ? String(payload.superseded_edict_id) : null,
          sealedAt,
        )
        .run()
    }

    if (message.genre === 'ti_definition') {
      const payload = message.payload as Record<string, unknown>
      const targetGenre = payload.target_genre
      if (typeof targetGenre !== 'string') return
      await this.db
        .prepare(
          `INSERT INTO ti_definition_index(message_id, target_genre, version, schema_json, superseded_by, sealed_at)
           VALUES(?, ?, ?, ?, ?, ?)
           ON CONFLICT(message_id) DO UPDATE SET
             target_genre = excluded.target_genre,
             version = excluded.version,
             schema_json = excluded.schema_json,
             superseded_by = excluded.superseded_by,
             sealed_at = excluded.sealed_at`,
        )
        .bind(
          messageId,
          targetGenre,
          String(payload.version ?? '1.0.0'),
          JSON.stringify((payload.schema ?? {}) as Record<string, unknown>),
          payload.superseded_by ? String(payload.superseded_by) : null,
          sealedAt,
        )
        .run()
    }
  }

  private async tryExec(sql: string): Promise<void> {
    try {
      await this.db.exec(sql)
    } catch {
      // Column may already exist on adapters that do not support IF NOT EXISTS for ALTER TABLE.
    }
  }
}
