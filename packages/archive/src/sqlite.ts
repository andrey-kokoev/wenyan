import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
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
import type { ArchiveRepository, ConstitutionalDocumentRef, DocketItem, TiDefinitionRecord } from './index'

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
        genre TEXT,
        payload_json TEXT NOT NULL,
        seal_chain_json TEXT NOT NULL DEFAULT '[]',
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
    `)

    const cols = this.db.prepare(`PRAGMA table_info(messages)`).all() as Array<{ name: string }>
    const colNames = new Set(cols.map((c) => c.name))
    if (!colNames.has('genre')) this.db.exec('ALTER TABLE messages ADD COLUMN genre TEXT')
    if (!colNames.has('constitutional')) this.db.exec('ALTER TABLE messages ADD COLUMN constitutional INTEGER NOT NULL DEFAULT 0')
    if (!colNames.has('superseded_by')) this.db.exec('ALTER TABLE messages ADD COLUMN superseded_by TEXT')
    if (!colNames.has('submitted_at')) this.db.exec('ALTER TABLE messages ADD COLUMN submitted_at TEXT')
    if (!colNames.has('archived_at')) this.db.exec('ALTER TABLE messages ADD COLUMN archived_at TEXT')

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_genre ON messages(genre);
      CREATE INDEX IF NOT EXISTS idx_constitutional_genre ON messages(constitutional, genre, archived_at);
      CREATE INDEX IF NOT EXISTS idx_edict_lookup ON edict_index(law_type, effective_date DESC, precedence DESC, sealed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_edict_supersession ON edict_index(superseded_edict_id);
      CREATE INDEX IF NOT EXISTS idx_ti_lookup ON ti_definition_index(target_genre, sealed_at DESC);
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
  }

  appendMessage(message: MessageEnvelope): void {
    const payload = message.payload as Record<string, unknown>
    const metadata = message.metadata as Record<string, unknown>
    const constitutional = message.genre === 'ti_definition' || metadata.constitutional === true ? 1 : 0
    const supersededBy =
      (typeof payload.superseded_by === 'string' ? payload.superseded_by : undefined) ??
      (typeof payload.superseded_edict_id === 'string' ? payload.superseded_edict_id : undefined) ??
      null
    this.db
      .prepare('INSERT INTO messages(id, genre, payload_json, seal_chain_json, constitutional, superseded_by, received_at, submitted_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        message.id,
        message.genre,
        JSON.stringify(message),
        '[]',
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
