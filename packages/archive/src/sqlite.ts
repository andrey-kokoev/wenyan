import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import {
  canTransition,
  EdictLawTypeValues,
  type EdictLawType,
  type Seal0Receipt,
  type MessageEnvelope,
  type MessageState,
  type ResolvedLaw,
  type Transition,
} from '@andrey-kokoev/wenyan-core'
import type { SealRecord } from '@andrey-kokoev/wenyan-seal'
import type {
  ArchiveRepository,
  BridgeDeadLetterRecord,
  BridgeOutboundQueueItem,
  ConstitutionalDocumentRef,
  DocketItem,
  ForeignRejectedRecord,
  ForeignSyncStateRecord,
  GossipLogEntry,
  MerkleProof,
  CensorateAlertRecord,
  AuditCheckpointRecord,
  TiDefinitionRecord,
  SiteStatus,
} from './index'
import { buildMerkleProofFromLeaves, merkleRootForLeaves } from './merkle-dag'

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
    this.assertIntegrity()
  }

  private assertIntegrity(): void {
    const rows = this.db.prepare('PRAGMA quick_check').all() as Array<Record<string, unknown>>
    const values = rows
      .map((row) => String(Object.values(row)[0] ?? ''))
      .filter(Boolean)
    if (!values.includes('ok')) {
      throw new Error(`archive-integrity-check-failed:${values.join(',') || 'unknown'}`)
    }
  }

  initialize(): void {
    this.db.exec(`
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
        archived_at TEXT,
        FOREIGN KEY(superseded_by) REFERENCES messages(id)
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

      CREATE TABLE IF NOT EXISTS edict_index (
        message_id TEXT PRIMARY KEY,
        law_type TEXT NOT NULL,
        version TEXT NOT NULL,
        content_json TEXT NOT NULL,
        precedence INTEGER NOT NULL,
        effective_date TEXT NOT NULL,
        superseded_edict_id TEXT,
        sealed_at TEXT NOT NULL,
        FOREIGN KEY(message_id) REFERENCES messages(id)
      );

      CREATE TABLE IF NOT EXISTS ti_definition_index (
        message_id TEXT PRIMARY KEY,
        target_genre TEXT NOT NULL,
        version TEXT NOT NULL,
        schema_json TEXT NOT NULL,
        superseded_by TEXT,
        sealed_at TEXT NOT NULL,
        FOREIGN KEY(message_id) REFERENCES messages(id)
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
        last_error TEXT,
        FOREIGN KEY(document_id) REFERENCES messages(id)
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
        status TEXT NOT NULL DEFAULT 'queued',
        FOREIGN KEY(message_id) REFERENCES messages(id)
      );

      CREATE TABLE IF NOT EXISTS bridge_dead_letter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adapter_id TEXT NOT NULL,
        message_id TEXT,
        payload_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS site_runtime_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS seal_0_log (
        id TEXT PRIMARY KEY,
        document_id TEXT,
        actor_id TEXT NOT NULL,
        genre TEXT,
        query_timestamp TEXT NOT NULL,
        query_parameters_hash TEXT NOT NULL,
        result_hash TEXT NOT NULL,
        result_status TEXT NOT NULL,
        reason TEXT,
        signature TEXT NOT NULL,
        trace_id TEXT,
        node_id TEXT
      );

      CREATE TABLE IF NOT EXISTS censorate_alerts (
        id TEXT PRIMARY KEY,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        actor_id TEXT,
        node_id TEXT,
        evidence_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        action_taken TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_checkpoints (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        merkle_root TEXT NOT NULL,
        seal_count INTEGER NOT NULL,
        node_signatures_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `)

    const cols = this.db.prepare(`PRAGMA table_info(messages)`).all() as Array<{ name: string }>
    const colNames = new Set(cols.map((c) => c.name))
    if (!colNames.has('genre')) this.db.exec('ALTER TABLE messages ADD COLUMN genre TEXT')
    if (!colNames.has('origin_node_id')) this.db.exec('ALTER TABLE messages ADD COLUMN origin_node_id TEXT')
    if (!colNames.has('vector_clock_json')) this.db.exec('ALTER TABLE messages ADD COLUMN vector_clock_json TEXT')
    if (!colNames.has('content_hash')) this.db.exec('ALTER TABLE messages ADD COLUMN content_hash TEXT')
    if (!colNames.has('constitutional')) this.db.exec('ALTER TABLE messages ADD COLUMN constitutional INTEGER NOT NULL DEFAULT 0')
    if (!colNames.has('superseded_by')) this.db.exec('ALTER TABLE messages ADD COLUMN superseded_by TEXT')
    if (!colNames.has('submitted_at')) this.db.exec('ALTER TABLE messages ADD COLUMN submitted_at TEXT')
    if (!colNames.has('archived_at')) this.db.exec('ALTER TABLE messages ADD COLUMN archived_at TEXT')

    this.db.exec(`
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
      CREATE INDEX IF NOT EXISTS idx_bridge_dead_letter_retry ON bridge_dead_letter(next_retry_at ASC, attempts ASC);
      CREATE INDEX IF NOT EXISTS idx_seal0_document_time ON seal_0_log(document_id, query_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_seal0_actor_time ON seal_0_log(actor_id, query_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_seal0_status_time ON seal_0_log(result_status, query_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_type_time ON censorate_alerts(alert_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_scope_time ON audit_checkpoints(scope, created_at DESC);
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

    const latestPostV2 = this.db.prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1').get() as
      | { version: number; migration_hash: string }
      | undefined
    if (!latestPostV2) return

    const v3Hash = sha256(`${latestPostV2.migration_hash}:archive-schema-v3-law-indexes`)
    if (latestPostV2.version < 3) {
      this.db.exec(`
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

      this.db.exec(`
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

      this.db.exec(`
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

      this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(3, ?, ?, ?)')
        .run(v3Hash, latestPostV2.migration_hash, new Date().toISOString())
    }

    const latestPostV3 = this.db.prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1').get() as
      | { version: number; migration_hash: string }
      | undefined
    if (!latestPostV3) return

    const v4Hash = sha256(`${latestPostV3.migration_hash}:archive-schema-v4-constitutional-columns`)
    if (latestPostV3.version < 4) {
      this.db.exec(`
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

      this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(4, ?, ?, ?)')
        .run(v4Hash, latestPostV3.migration_hash, new Date().toISOString())
    }

    const latestPostV4 = this.db.prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1').get() as
      | { version: number; migration_hash: string }
      | undefined
    if (!latestPostV4) return
    const v5Hash = sha256(`${latestPostV4.migration_hash}:archive-schema-v5-consort`)
    if (latestPostV4.version < 5) {
      this.db.exec(`
        UPDATE messages
        SET origin_node_id = COALESCE(origin_node_id, json_extract(payload_json, '$.metadata.consort.origin_node_id'), 'local-node');
        UPDATE messages
        SET vector_clock_json = COALESCE(vector_clock_json, json_object(COALESCE(origin_node_id, 'local-node'), 1));
        UPDATE messages
        SET content_hash = COALESCE(content_hash, lower(hex(randomblob(16))));
      `)
      this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(5, ?, ?, ?)')
        .run(v5Hash, latestPostV4.migration_hash, new Date().toISOString())
    }

    const latestPostV5 = this.db.prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1').get() as
      | { version: number; migration_hash: string }
      | undefined
    if (!latestPostV5) return
    const v6Hash = sha256(`${latestPostV5.migration_hash}:archive-schema-v6-bridge`)
    if (latestPostV5.version < 6) {
      this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(6, ?, ?, ?)')
        .run(v6Hash, latestPostV5.migration_hash, new Date().toISOString())
    }

    const latestPostV6 = this.db.prepare('SELECT version, migration_hash FROM archive_migrations ORDER BY version DESC LIMIT 1').get() as
      | { version: number; migration_hash: string }
      | undefined
    if (!latestPostV6) return
    const v7Hash = sha256(`${latestPostV6.migration_hash}:archive-schema-v7-censorate`)
    if (latestPostV6.version < 7) {
      this.db
        .prepare('INSERT INTO archive_migrations(version, migration_hash, prev_hash, applied_at) VALUES(7, ?, ?, ?)')
        .run(v7Hash, latestPostV6.migration_hash, new Date().toISOString())
    }
  }

  appendMessage(message: MessageEnvelope): void {
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
    this.db
      .prepare('INSERT INTO messages(id, genre, payload_json, seal_chain_json, origin_node_id, vector_clock_json, content_hash, constitutional, superseded_by, received_at, submitted_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
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

    if (transition.toState === 'archived') {
      const sealedAt = transition.sealedAt ?? transition.at
      this.db.prepare('UPDATE messages SET archived_at = ? WHERE id = ?').run(sealedAt, transition.messageId)
      this.indexArchivedMessage(transition.messageId, sealedAt)
    }
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

  stateAt(messageId: string, timestampIso: string): MessageState | undefined {
    const row = this.db
      .prepare(
        `SELECT to_state
         FROM transitions
         WHERE message_id = ? AND sealed_at <= ?
         ORDER BY sequence_no DESC
         LIMIT 1`,
      )
      .get(messageId, timestampIso) as { to_state?: MessageState } | undefined

    return row?.to_state
  }

  getActiveGenreSchema(targetGenre: string): Record<string, unknown> | undefined {
    const def = this.getCurrentTiDefinition(targetGenre)
    return def?.schema
  }

  getCurrentTiDefinition(genre: string, atIso = new Date().toISOString()): TiDefinitionRecord | undefined {
    const row = this.db
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
      .get(genre, atIso, atIso) as
      | { message_id: string; target_genre: string; version: string; schema_json: string; sealed_at: string }
      | undefined
    if (!row) return undefined
    return {
      messageId: row.message_id,
      targetGenre: row.target_genre,
      version: row.version,
      schema: JSON.parse(row.schema_json) as Record<string, unknown>,
      sealedAt: row.sealed_at,
    }
  }

  getCurrentLaw(lawType: EdictLawType, atIso: string): ResolvedLaw | undefined {
    const rows = this.db
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
      .all(lawType, atIso, atIso) as Array<{
      message_id: string
      law_type: string
      version: string
      content_json: string
      precedence: number
      effective_date: string
      sealed_at: string
    }>

    if (rows.length === 0) return undefined
    if (rows.length > 1) {
      const [a, b] = rows
      if (a.precedence === b.precedence && a.effective_date === b.effective_date && a.sealed_at === b.sealed_at) {
        throw new Error('ambiguous-law')
      }
    }

    const top = rows[0]
    return {
      messageId: top.message_id,
      lawType: top.law_type as EdictLawType,
      version: top.version,
      content: JSON.parse(top.content_json) as Record<string, unknown>,
      precedence: Number(top.precedence),
      effectiveDate: top.effective_date,
      sealedAt: top.sealed_at,
    }
  }

  getLawSet(atIso: string): Record<EdictLawType, ResolvedLaw | undefined> {
    const out = {} as Record<EdictLawType, ResolvedLaw | undefined>
    for (const lawType of EdictLawTypeValues) {
      out[lawType] = this.getCurrentLaw(lawType, atIso)
    }
    return out
  }

  getConstitutionalDocuments(): ConstitutionalDocumentRef[] {
    const rows = this.db
      .prepare(
        `SELECT id, archived_at
         FROM messages
         WHERE constitutional = 1
           AND archived_at IS NOT NULL
         ORDER BY archived_at ASC, id ASC`,
      )
      .all() as Array<{ id: string; archived_at: string }>
    return rows.map((r) => ({ id: r.id, archivedAt: r.archived_at }))
  }

  getMerkleRoot(scope: 'all' | 'constitutional' | 'legislative' = 'all'): string {
    const { leaves } = this.collectMerkleLeaves(scope)
    const root = merkleRootForLeaves(leaves)
    this.db
      .prepare(
        `INSERT INTO archive_state(scope, merkle_root, updated_at) VALUES(?, ?, ?)
         ON CONFLICT(scope) DO UPDATE SET merkle_root = excluded.merkle_root, updated_at = excluded.updated_at`,
      )
      .run(scope, root, new Date().toISOString())
    return root
  }

  getMerkleProof(messageId: string): MerkleProof | undefined {
    const { leaves, messageLeafRows } = this.collectMerkleLeaves('all')
    const idx = messageLeafRows.findIndex((r) => r.id === messageId)
    if (idx < 0) return undefined
    const proof = buildMerkleProofFromLeaves(leaves, idx)
    return {
      messageId,
      leafHash: proof.leafHash,
      rootHash: proof.rootHash,
      path: proof.path,
    }
  }

  private collectMerkleLeaves(scope: 'all' | 'constitutional' | 'legislative'): {
    leaves: string[]
    messageLeafRows: Array<{ id: string; h: string }>
  } {
    let where = 'archived_at IS NOT NULL'
    if (scope === 'constitutional') where += ' AND constitutional = 1'
    if (scope === 'legislative') where += " AND genre = 'edict'"
    const messageLeafRows = this.db
      .prepare(`SELECT id, COALESCE(content_hash, id) AS h FROM messages WHERE ${where} ORDER BY archived_at ASC, id ASC`)
      .all() as Array<{ id: string; h: string }>
    const leaves = messageLeafRows.map((r) => r.h)
    if (scope === 'all') {
      const reads = this.db
        .prepare('SELECT id, query_timestamp, result_hash FROM seal_0_log ORDER BY query_timestamp ASC, id ASC')
        .all() as Array<{ id: string; query_timestamp: string; result_hash: string }>
      const alerts = this.db
        .prepare('SELECT id, created_at FROM censorate_alerts ORDER BY created_at ASC, id ASC')
        .all() as Array<{ id: string; created_at: string }>
      const checkpoints = this.db
        .prepare('SELECT id, created_at FROM audit_checkpoints ORDER BY created_at ASC, id ASC')
        .all() as Array<{ id: string; created_at: string }>
      for (const r of reads) leaves.push(sha256(`${r.query_timestamp}:${r.id}:${r.result_hash}`))
      for (const a of alerts) leaves.push(sha256(`${a.created_at}:${a.id}`))
      for (const c of checkpoints) leaves.push(sha256(`${c.created_at}:${c.id}`))
    }
    return { leaves, messageLeafRows }
  }

  getSyncRange(fromCursor: string, limit: number): Transition[] {
    const cursor = Number(fromCursor) || 0
    const rows = this.db
      .prepare(
        `SELECT id, message_id, from_state, to_state, sequence_no, actor_id, sealed_at, reason, prev_transition_hash, at
         FROM transitions
         WHERE id > ?
         ORDER BY id ASC
         LIMIT ?`,
      )
      .all(cursor, limit) as Array<{
      id: number
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

  upsertContentBlob(hash: string, payload: Uint8Array | string): void {
    const blob = typeof payload === 'string' ? Buffer.from(payload) : Buffer.from(payload)
    this.db
      .prepare(
        `INSERT INTO content_store(hash, payload_blob, ref_count) VALUES(?, ?, 1)
         ON CONFLICT(hash) DO UPDATE SET ref_count = ref_count + 1`,
      )
      .run(hash, blob)
  }

  getContentBlob(hash: string): Uint8Array | undefined {
    const row = this.db.prepare('SELECT payload_blob FROM content_store WHERE hash = ?').get(hash) as { payload_blob?: Buffer } | undefined
    if (!row?.payload_blob) return undefined
    return new Uint8Array(row.payload_blob)
  }

  appendGossipLog(entry: GossipLogEntry): void {
    this.db
      .prepare('INSERT INTO gossip_log(message_id, peer_node_id, seal_seq, received_at, kind) VALUES(?, ?, ?, ?, ?)')
      .run(entry.messageId, entry.peerNodeId, entry.sealSeq, entry.receivedAt, entry.kind)
  }

  appendForeignRejected(entry: ForeignRejectedRecord): void {
    this.db
      .prepare(
        'INSERT INTO foreign_rejected(adapter_id, foreign_id, reason_code, reason_detail, payload_json, received_at) VALUES(?, ?, ?, ?, ?, ?)',
      )
      .run(
        entry.adapterId,
        entry.foreignId ?? null,
        entry.reasonCode,
        entry.reasonDetail ?? null,
        entry.payloadJson ?? null,
        entry.receivedAt,
      )
  }

  upsertForeignSyncState(entry: ForeignSyncStateRecord): void {
    this.db
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
      .run(
        entry.documentId,
        entry.adapterId,
        entry.adapterProtocol,
        entry.foreignId,
        entry.foreignVectorClockJson ?? null,
        entry.lastSyncAt,
        entry.conflictStatus,
        entry.lastError ?? null,
      )
  }

  getForeignSyncState(documentId: string): ForeignSyncStateRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT document_id, adapter_id, adapter_protocol, foreign_id, foreign_vector_clock_json, last_sync_at, conflict_status, last_error
         FROM foreign_sync_state WHERE document_id = ?`,
      )
      .get(documentId) as
      | {
          document_id: string
          adapter_id: string
          adapter_protocol: 'nats' | 'kafka' | 'mqtt' | 'erp' | 'payroll' | 'regulatory'
          foreign_id: string
          foreign_vector_clock_json: string | null
          last_sync_at: string
          conflict_status: 'resolved' | 'pending' | 'schism'
          last_error: string | null
        }
      | undefined
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

  enqueueBridgeOutbound(adapterId: string, messageId: string, availableAt: string): void {
    this.db
      .prepare('INSERT INTO bridge_outbound_queue(adapter_id, message_id, attempts, available_at, status) VALUES(?, ?, 0, ?, ?)')
      .run(adapterId, messageId, availableAt, 'queued')
  }

  dequeueBridgeOutbound(nowIso: string, limit: number): BridgeOutboundQueueItem[] {
    const rows = this.db
      .prepare(
        `SELECT id, adapter_id, message_id, attempts, available_at, last_error, status
         FROM bridge_outbound_queue
         WHERE available_at <= ? AND status IN ('queued', 'failed')
         ORDER BY available_at ASC, id ASC
         LIMIT ?`,
      )
      .all(nowIso, limit) as Array<{
      id: number
      adapter_id: string
      message_id: string
      attempts: number
      available_at: string
      last_error: string | null
      status: BridgeOutboundQueueItem['status']
    }>
    return rows.map((r) => ({
      id: r.id,
      adapterId: r.adapter_id,
      messageId: r.message_id,
      attempts: r.attempts,
      availableAt: r.available_at,
      lastError: r.last_error ?? undefined,
      status: r.status,
    }))
  }

  markBridgeOutboundResult(id: number, status: BridgeOutboundQueueItem['status'], lastError?: string): void {
    if (status === 'sent') {
      this.db.prepare('DELETE FROM bridge_outbound_queue WHERE id = ?').run(id)
      return
    }
    this.db
      .prepare(
        `UPDATE bridge_outbound_queue
         SET status = ?, attempts = attempts + 1, last_error = ?, available_at = ?
         WHERE id = ?`,
      )
      .run(status, lastError ?? null, new Date().toISOString(), id)
  }

  setSiteStatus(status: SiteStatus, reason?: string): void {
    this.db
      .prepare(
        `INSERT INTO site_runtime_state(key, value_json, updated_at)
         VALUES('site_status', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(JSON.stringify({ status, reason: reason ?? null }), new Date().toISOString())
  }

  getSiteStatus(): SiteStatus {
    const row = this.db
      .prepare('SELECT value_json FROM site_runtime_state WHERE key = ?')
      .get('site_status') as { value_json: string } | undefined
    if (!row) return 'ACTIVE'
    try {
      const parsed = JSON.parse(row.value_json) as { status?: SiteStatus }
      if (parsed.status === 'QUARANTINED' || parsed.status === 'RESUMED' || parsed.status === 'ACTIVE') {
        return parsed.status
      }
    } catch {
      // ignore malformed runtime value
    }
    return 'ACTIVE'
  }

  appendBridgeDeadLetter(entry: BridgeDeadLetterRecord): void {
    this.db
      .prepare(
        `INSERT INTO bridge_dead_letter(adapter_id, message_id, payload_json, reason, attempts, next_retry_at, created_at)
         VALUES(?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.adapterId,
        entry.messageId ?? null,
        entry.payloadJson,
        entry.reason,
        entry.attempts,
        entry.nextRetryAt,
        entry.createdAt,
      )
  }

  dequeueBridgeDeadLetter(nowIso: string, limit: number): BridgeDeadLetterRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, adapter_id, message_id, payload_json, reason, attempts, next_retry_at, created_at
         FROM bridge_dead_letter
         WHERE next_retry_at <= ?
         ORDER BY next_retry_at ASC, id ASC
         LIMIT ?`,
      )
      .all(nowIso, limit) as Array<{
      id: number
      adapter_id: string
      message_id: string | null
      payload_json: string
      reason: string
      attempts: number
      next_retry_at: string
      created_at: string
    }>
    return rows.map((r) => ({
      id: r.id,
      adapterId: r.adapter_id,
      messageId: r.message_id ?? undefined,
      payloadJson: r.payload_json,
      reason: r.reason,
      attempts: r.attempts,
      nextRetryAt: r.next_retry_at,
      createdAt: r.created_at,
    }))
  }

  markBridgeDeadLetterResult(id: number, success: boolean, nextRetryAt?: string, reason?: string): void {
    if (success) {
      this.db.prepare('DELETE FROM bridge_dead_letter WHERE id = ?').run(id)
      return
    }
    this.db
      .prepare(
        `UPDATE bridge_dead_letter
         SET attempts = attempts + 1,
             next_retry_at = ?,
             reason = ?
         WHERE id = ?`,
      )
      .run(nextRetryAt ?? new Date().toISOString(), reason ?? 'retry', id)
  }

  appendSeal0Receipt(receipt: Seal0Receipt): void {
    this.db
      .prepare(
        `INSERT INTO seal_0_log(
          id, document_id, actor_id, genre, query_timestamp, query_parameters_hash, result_hash, result_status, reason, signature, trace_id, node_id
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        receipt.id,
        receipt.document_id,
        receipt.actor_id,
        receipt.genre ?? null,
        receipt.query_timestamp,
        receipt.query_parameters_hash,
        receipt.result_hash,
        receipt.result_status,
        receipt.reason ?? null,
        receipt.signature,
        receipt.trace_id ?? null,
        receipt.node_id ?? null,
      )
  }

  querySeal0ByDocument(
    documentId: string,
    filters: { since?: string; actorId?: string; limit?: number } = {},
  ): Seal0Receipt[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM seal_0_log
         WHERE document_id = ?
           AND (? IS NULL OR query_timestamp >= ?)
           AND (? IS NULL OR actor_id = ?)
         ORDER BY query_timestamp DESC
         LIMIT ?`,
      )
      .all(documentId, filters.since ?? null, filters.since ?? null, filters.actorId ?? null, filters.actorId ?? null, filters.limit ?? 100) as Array<
      Record<string, unknown>
    >
    return rows.map((r) => ({
      id: String(r.id),
      document_id: (r.document_id as string | null) ?? null,
      actor_id: String(r.actor_id),
      genre: (r.genre as string | null) ?? undefined,
      query_timestamp: String(r.query_timestamp),
      query_parameters_hash: String(r.query_parameters_hash),
      result_hash: String(r.result_hash),
      result_status: r.result_status as 'allowed' | 'denied',
      reason: (r.reason as string | null) ?? undefined,
      signature: String(r.signature),
      trace_id: (r.trace_id as string | null) ?? undefined,
      node_id: (r.node_id as string | null) ?? undefined,
    }))
  }

  querySeal0ByGenre(
    genre: string,
    filters: { since?: string; actorId?: string; limit?: number } = {},
  ): Seal0Receipt[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM seal_0_log
         WHERE genre = ?
           AND (? IS NULL OR query_timestamp >= ?)
           AND (? IS NULL OR actor_id = ?)
         ORDER BY query_timestamp DESC
         LIMIT ?`,
      )
      .all(genre, filters.since ?? null, filters.since ?? null, filters.actorId ?? null, filters.actorId ?? null, filters.limit ?? 100) as Array<
      Record<string, unknown>
    >
    return rows.map((r) => ({
      id: String(r.id),
      document_id: (r.document_id as string | null) ?? null,
      actor_id: String(r.actor_id),
      genre: (r.genre as string | null) ?? undefined,
      query_timestamp: String(r.query_timestamp),
      query_parameters_hash: String(r.query_parameters_hash),
      result_hash: String(r.result_hash),
      result_status: r.result_status as 'allowed' | 'denied',
      reason: (r.reason as string | null) ?? undefined,
      signature: String(r.signature),
      trace_id: (r.trace_id as string | null) ?? undefined,
      node_id: (r.node_id as string | null) ?? undefined,
    }))
  }

  appendCensorateAlert(alert: CensorateAlertRecord): void {
    const id = alert.id ?? `${alert.alertType}:${Date.now()}`
    this.db
      .prepare(
        `INSERT INTO censorate_alerts(
          id, alert_type, severity, actor_id, node_id, evidence_json, created_at, action_taken
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        alert.alertType,
        alert.severity,
        alert.actorId ?? null,
        alert.nodeId ?? null,
        JSON.stringify(alert.evidence),
        alert.createdAt,
        alert.actionTaken ?? null,
      )
  }

  queryCensorateAlerts(
    window: { since?: string; limit?: number; type?: string } = {},
  ): CensorateAlertRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM censorate_alerts
         WHERE (? IS NULL OR created_at >= ?)
           AND (? IS NULL OR alert_type = ?)
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(window.since ?? null, window.since ?? null, window.type ?? null, window.type ?? null, window.limit ?? 100) as Array<
      Record<string, unknown>
    >
    return rows.map((r) => ({
      id: String(r.id),
      alertType: String(r.alert_type),
      severity: r.severity as 'info' | 'warning' | 'critical',
      actorId: (r.actor_id as string | null) ?? undefined,
      nodeId: (r.node_id as string | null) ?? undefined,
      evidence: JSON.parse(String(r.evidence_json)) as Record<string, unknown>,
      createdAt: String(r.created_at),
      actionTaken: (r.action_taken as string | null) ?? undefined,
    }))
  }

  appendAuditCheckpoint(entry: AuditCheckpointRecord): void {
    const id = entry.id ?? `checkpoint:${entry.scope}:${entry.createdAt}`
    this.db
      .prepare(
        `INSERT INTO audit_checkpoints(id, scope, merkle_root, seal_count, node_signatures_json, created_at)
         VALUES(?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        entry.scope,
        entry.merkleRoot,
        entry.sealCount,
        JSON.stringify(entry.nodeSignatures),
        entry.createdAt,
      )
  }

  exportAuditBundle(input: { start?: string; end?: string; merkleRoot?: string }): unknown {
    const sealRows = this.db
      .prepare(
        `SELECT *
         FROM seal_0_log
         WHERE (? IS NULL OR query_timestamp >= ?)
           AND (? IS NULL OR query_timestamp <= ?)
         ORDER BY query_timestamp ASC`,
      )
      .all(input.start ?? null, input.start ?? null, input.end ?? null, input.end ?? null) as Array<Record<string, unknown>>

    const checkpoint = input.merkleRoot
      ? (this.db
          .prepare('SELECT * FROM audit_checkpoints WHERE merkle_root = ? ORDER BY created_at DESC LIMIT 1')
          .get(input.merkleRoot) as Record<string, unknown> | undefined)
      : (this.db
          .prepare('SELECT * FROM audit_checkpoints ORDER BY created_at DESC LIMIT 1')
          .get() as Record<string, unknown> | undefined)

    const normalizedCheckpoint = checkpoint
      ? {
          id: String(checkpoint.id),
          scope: String(checkpoint.scope),
          merkleRoot: String(checkpoint.merkle_root),
          sealCount: Number(checkpoint.seal_count),
          nodeSignatures: JSON.parse(String(checkpoint.node_signatures_json)) as string[],
          createdAt: String(checkpoint.created_at),
        }
      : undefined

    return {
      checkpoint: normalizedCheckpoint,
      reads: sealRows,
      digest: sha256(JSON.stringify(normalizedCheckpoint ?? {})),
    }
  }

  private indexArchivedMessage(messageId: string, sealedAt: string): void {
    const message = this.getMessage(messageId)
    if (!message) return
    const payload = message.payload as Record<string, unknown>
    const metadata = message.metadata as Record<string, unknown>
    const constitutional = message.genre === 'ti_definition' || metadata.constitutional === true ? 1 : 0
    const supersededBy =
      (typeof payload.superseded_by === 'string' ? payload.superseded_by : undefined) ??
      (typeof payload.superseded_edict_id === 'string' ? payload.superseded_edict_id : undefined) ??
      null
    this.db.prepare('UPDATE messages SET constitutional = ?, superseded_by = ? WHERE id = ?').run(constitutional, supersededBy, messageId)

    if (message.genre === 'edict') {
      const lawType = payload.law_type
      if (typeof lawType !== 'string') return
      this.db
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
        .run(
          messageId,
          lawType,
          String(payload.version ?? '1.0.0'),
          JSON.stringify((payload.content ?? {}) as Record<string, unknown>),
          Number(payload.precedence ?? 0),
          String(payload.effective_date ?? message.submittedAt),
          payload.superseded_edict_id ? String(payload.superseded_edict_id) : null,
          sealedAt,
        )
    }

    if (message.genre === 'ti_definition') {
      const payload = message.payload as Record<string, unknown>
      const targetGenre = payload.target_genre
      if (typeof targetGenre !== 'string') return
      this.db
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
        .run(
          messageId,
          targetGenre,
          String(payload.version ?? '1.0.0'),
          JSON.stringify((payload.schema ?? {}) as Record<string, unknown>),
          payload.superseded_by ? String(payload.superseded_by) : null,
          sealedAt,
        )
    }
  }

  close(): void {
    this.db.close()
  }
}
