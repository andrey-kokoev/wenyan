import { describe, expect, it } from 'vitest'
import { InMemoryArchiveRepository } from './index'

type TestMessage = Parameters<InMemoryArchiveRepository['appendMessage']>[0]

function message(input: Partial<TestMessage> & Pick<TestMessage, 'id' | 'genre' | 'payload'>): TestMessage {
  return {
    id: input.id,
    genre: input.genre,
    payload: input.payload,
    actor: input.actor ?? { id: 'tester', role: 'admin' },
    submittedAt: input.submittedAt ?? new Date().toISOString(),
    metadata: input.metadata ?? {},
  }
}

function archive(repo: InMemoryArchiveRepository, msg: TestMessage, sealedAt: string): void {
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
    const repo = new InMemoryArchiveRepository()
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
  })

  it('excludes superseded law from active resolution', () => {
    const repo = new InMemoryArchiveRepository()
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
  })

  it('throws ambiguous-law when top two candidates tie', () => {
    const repo = new InMemoryArchiveRepository()

    archive(
      repo,
      message({
        id: 'e-a',
        genre: 'edict',
        payload: {
          law_type: 'routing',
          version: '1.0.0',
          content: { table: {} },
          precedence: 1,
          effective_date: '2026-02-01T00:00:00.000Z',
        },
      }),
      '2026-02-10T00:00:00.000Z',
    )

    archive(
      repo,
      message({
        id: 'e-b',
        genre: 'edict',
        payload: {
          law_type: 'routing',
          version: '1.0.1',
          content: { table: {} },
          precedence: 1,
          effective_date: '2026-02-01T00:00:00.000Z',
        },
      }),
      '2026-02-10T00:00:00.000Z',
    )

    expect(() => repo.getCurrentLaw('routing', '2026-03-01T00:00:00.000Z')).toThrowError('ambiguous-law')
  })
})

describe('archive ti-definition resolution', () => {
  it('returns only active non-superseded schema', () => {
    const repo = new InMemoryArchiveRepository()

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
  })
})
