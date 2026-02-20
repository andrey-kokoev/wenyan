import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import { SqliteArchiveRepository } from './sqlite'

type TestMessage = Parameters<SqliteArchiveRepository['appendMessage']>[0]

const tempFiles = new Set<string>()

afterEach(() => {
  for (const f of tempFiles) {
    if (existsSync(f)) unlinkSync(f)
    if (existsSync(`${f}-wal`)) unlinkSync(`${f}-wal`)
    if (existsSync(`${f}-shm`)) unlinkSync(`${f}-shm`)
  }
  tempFiles.clear()
})

function repoFor(name: string): SqliteArchiveRepository {
  const file = `.tmp-archive-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  tempFiles.add(file)
  const repo = new SqliteArchiveRepository(file)
  repo.initialize()
  repo.migrate()
  return repo
}

function message(input: Partial<TestMessage> & Pick<TestMessage, 'id' | 'genre' | 'payload'>): TestMessage {
  return {
    id: input.id,
    genre: input.genre,
    payload: input.payload,
    actor: input.actor ?? { id: 'tester', role: 'genesis_admin' },
    submittedAt: input.submittedAt ?? new Date().toISOString(),
    metadata: input.metadata ?? {},
  }
}

function archive(repo: SqliteArchiveRepository, msg: TestMessage, sealedAt: string): void {
  repo.appendMessage(msg)
  repo.appendTransition({
    messageId: msg.id,
    fromState: 'pending',
    toState: 'archived',
    sequenceNo: 1,
    actorId: msg.actor.id,
    sealedAt,
    prevTransitionHash: 'GENESIS',
    at: sealedAt,
  })
}

describe('archive law resolution', () => {
  it('resolves by precedence, then effective_date, then sealed_at', () => {
    const repo = repoFor('law-order')
    const at = '2026-02-20T12:00:00.000Z'

    archive(
      repo,
      message({
        id: 'e-low',
        genre: 'edict',
        payload: {
          law_type: 'admission',
          version: '1.0.0',
          content: { allowed_genres: ['petition'] },
          precedence: 1,
          effective_date: '2026-02-01T00:00:00.000Z',
        },
      }),
      '2026-02-10T00:00:00.000Z',
    )

    archive(
      repo,
      message({
        id: 'e-high',
        genre: 'edict',
        payload: {
          law_type: 'admission',
          version: '1.1.0',
          content: { allowed_genres: ['*'] },
          precedence: 5,
          effective_date: '2026-02-01T00:00:00.000Z',
        },
      }),
      '2026-02-11T00:00:00.000Z',
    )

    const law = repo.getCurrentLaw('admission', at)
    expect(law?.messageId).toBe('e-high')
    expect(law?.version).toBe('1.1.0')
    repo.close()
  })

  it('excludes superseded law from active resolution', () => {
    const repo = repoFor('law-superseded')
    const at = '2026-02-20T12:00:00.000Z'

    archive(
      repo,
      message({
        id: 'e-old',
        genre: 'edict',
        payload: {
          law_type: 'classification',
          version: '1.0.0',
          content: { levels: ['open'] },
          precedence: 100,
          effective_date: '2026-01-01T00:00:00.000Z',
        },
      }),
      '2026-01-01T00:00:00.000Z',
    )

    archive(
      repo,
      message({
        id: 'e-new',
        genre: 'edict',
        payload: {
          law_type: 'classification',
          version: '1.1.0',
          content: { levels: ['open', 'inner'] },
          precedence: 0,
          effective_date: '2026-02-01T00:00:00.000Z',
          superseded_edict_id: 'e-old',
        },
      }),
      '2026-02-01T00:00:00.000Z',
    )

    const law = repo.getCurrentLaw('classification', at)
    expect(law?.messageId).toBe('e-new')
    expect((law?.content as { levels?: string[] }).levels).toEqual(['open', 'inner'])
    repo.close()
  })
})

describe('archive ti-definition resolution', () => {
  it('returns only active non-superseded schema', () => {
    const repo = repoFor('ti-active')

    archive(
      repo,
      message({
        id: 'ti-v1',
        genre: 'ti_definition',
        payload: {
          target_genre: 'petition',
          version: '1.0.0',
          schema: { required: ['title'] },
        },
      }),
      '2026-01-01T00:00:00.000Z',
    )

    archive(
      repo,
      message({
        id: 'ti-v2',
        genre: 'ti_definition',
        payload: {
          target_genre: 'petition',
          version: '2.0.0',
          schema: { required: ['title', 'body'] },
          superseded_by: 'ti-v1',
        },
      }),
      '2026-02-01T00:00:00.000Z',
    )

    const active = repo.getActiveGenreSchema('petition') as { required?: string[] } | undefined
    expect(active?.required).toEqual(['title', 'body'])
    repo.close()
  })
})

describe('archive bridge persistence', () => {
  it('persists foreign rejected records, sync state, and outbound queue lifecycle', () => {
    const repo = repoFor('bridge-state')
    const now = new Date().toISOString()
    const msg = message({
      id: 'bridge-msg-1',
      genre: 'edict',
      payload: {
        law_type: 'regulation',
        version: '1.0.0',
        content: { retention_days: 30 },
        precedence: 0,
        effective_date: now,
      },
    })
    archive(repo, msg, now)

    repo.appendForeignRejected({
      adapterId: 'nats-main',
      foreignId: 'f-1',
      reasonCode: 'invalid-shape',
      reasonDetail: 'missing payload field',
      payloadJson: '{"x":1}',
      receivedAt: now,
    })

    repo.upsertForeignSyncState({
      documentId: msg.id,
      adapterId: 'nats-main',
      adapterProtocol: 'nats',
      foreignId: 'subject.seq.1',
      foreignVectorClockJson: '{"nats":1}',
      lastSyncAt: now,
      conflictStatus: 'resolved',
    })
    const state = repo.getForeignSyncState(msg.id)
    expect(state?.adapterId).toBe('nats-main')
    expect(state?.foreignId).toBe('subject.seq.1')

    repo.enqueueBridgeOutbound('nats-main', msg.id, now)
    const queued = repo.dequeueBridgeOutbound(now, 10)
    expect(queued).toHaveLength(1)
    expect(queued[0]?.messageId).toBe(msg.id)
    repo.markBridgeOutboundResult(queued[0]!.id, 'sent')
    const after = repo.dequeueBridgeOutbound(now, 10)
    expect(after).toHaveLength(0)
    repo.close()
  })
})
