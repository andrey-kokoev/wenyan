import { describe, expect, it } from 'vitest'
import { InMemoryArchiveRepository } from '@wenyan/archive'
import { processDocketMessage } from './index'
import type { EdictLawType } from '@wenyan/core'

function archiveEdict(
  repo: InMemoryArchiveRepository,
  lawType: EdictLawType,
  content: Record<string, unknown>,
): void {
  const now = new Date().toISOString()
  const id = `edict-${lawType}`
  repo.appendMessage({
    id,
    genre: 'edict',
    payload: {
      law_type: lawType,
      version: '1.0.0',
      content,
      precedence: 0,
      effective_date: now,
    },
    actor: { id: 'law-seeder', role: 'admin' },
    submittedAt: now,
    metadata: { seeded: true },
  })
  repo.appendTransition({
    messageId: id,
    fromState: 'pending',
    toState: 'archived',
    sequenceNo: 1,
    actorId: 'law-seeder',
    sealedAt: now,
    prevTransitionHash: 'GENESIS',
    at: now,
  })
}

describe('pipeline', () => {
  it('produces 6 seals for successful path', async () => {
    const repo = new InMemoryArchiveRepository()
    const message = {
      id: 'm1',
      genre: 'memo',
      payload: { a: 1 },
      actor: { id: 'u1', role: 'admin' as const },
      submittedAt: new Date().toISOString(),
      metadata: {},
    }

    repo.appendMessage(message)
    const result = await processDocketMessage(repo, 'm1')

    expect(result.finalState).toBe('archived')
    expect(repo.getSeals('m1')).toHaveLength(6)
  })

  it('fails closed in strict mode when required law is missing', async () => {
    const repo = new InMemoryArchiveRepository()
    repo.appendMessage({
      id: 'm-strict-missing',
      genre: 'memo',
      payload: { a: 1 },
      actor: { id: 'u1', role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })

    const result = await processDocketMessage(repo, 'm-strict-missing', undefined, { lawMode: 'strict' })
    expect(result.finalState).toBe('rejected')
    expect(result.reason).toContain('missing-routing')
  })

  it('archives in strict mode when required laws exist', async () => {
    const repo = new InMemoryArchiveRepository()
    archiveEdict(repo, 'routing', { table: {}, broadcast_policy: 'hierarchical' })
    archiveEdict(repo, 'appointment', {
      roles: {
        admin: {
          permissions: ['draft', 'review', 'authorize'],
          allowed_genres: ['*'],
        },
      },
    })
    archiveEdict(repo, 'classification', {
      levels: ['open', 'inner', 'secret', 'top'],
      hierarchy: 'strict',
      compartmentalization: true,
    })
    archiveEdict(repo, 'protocol', {
      required_acks_by_genre: {},
    })

    repo.appendMessage({
      id: 'm-strict-ok',
      genre: 'memo',
      payload: { a: 1 },
      actor: { id: 'u1', role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })

    const result = await processDocketMessage(repo, 'm-strict-ok', undefined, { lawMode: 'strict' })
    expect(result.finalState).toBe('archived')
    expect(repo.getSeals('m-strict-ok')).toHaveLength(6)
  })
})
