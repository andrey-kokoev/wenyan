import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import { SqliteArchiveRepository } from '@andrey-kokoev/wenyan-archive/sqlite'
import { processDocketMessage } from './index'
import type { EdictLawType } from '@andrey-kokoev/wenyan-core'
import { DEV_SEAL_CONTEXT } from '@andrey-kokoev/wenyan-seal'

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
  const file = `.tmp-pipeline-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  tempFiles.add(file)
  const repo = new SqliteArchiveRepository(file)
  repo.initialize()
  repo.migrate()
  return repo
}

function archiveMessage(repo: SqliteArchiveRepository, message: Record<string, unknown>): void {
  const envelope = message as Parameters<SqliteArchiveRepository['appendMessage']>[0]
  repo.appendMessage(envelope)
  repo.appendTransition({
    messageId: envelope.id,
    fromState: 'pending',
    toState: 'archived',
    sequenceNo: 1,
    actorId: envelope.actor.id,
    sealedAt: new Date().toISOString(),
    prevTransitionHash: 'GENESIS',
    at: new Date().toISOString(),
  })
}

function seedGenre(repo: SqliteArchiveRepository, genre: string): void {
  archiveMessage(repo, {
    id: `ti-${genre}-${Date.now()}`,
    genre: 'ti_definition',
    payload: {
      target_genre: genre,
      version: '1.0.0',
      schema: { type: 'object', required: [] },
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true },
  })
}

function archiveEdict(repo: SqliteArchiveRepository, lawType: EdictLawType, content: Record<string, unknown>): void {
  archiveMessage(repo, {
    id: `edict-${lawType}-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: lawType,
      version: '1.0.0',
      content,
      precedence: 0,
      effective_date: new Date().toISOString(),
    },
    actor: { id: 'law-seeder', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true },
  })
}

describe('pipeline', () => {
  it('produces 6 seals for successful path in strict mode', async () => {
    const repo = repoFor('ok')
    seedGenre(repo, 'memo')
    archiveEdict(repo, 'routing', { table: {}, broadcast_policy: 'hierarchical' })
    archiveEdict(repo, 'appointment', {
      roles: {
        genesis_admin: {
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
    archiveEdict(repo, 'protocol', { required_acks_by_genre: {} })

    repo.appendMessage({
      id: 'm1',
      genre: 'memo',
      payload: { a: 1 },
      actor: { id: 'u1', role: 'genesis_admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })

    const result = await processDocketMessage(repo, 'm1', DEV_SEAL_CONTEXT, { lawMode: 'strict' })
    expect(result.finalState).toBe('archived')
    expect(repo.getSeals('m1')).toHaveLength(6)
    repo.close()
  })

  it('fails closed when required law is missing', async () => {
    const repo = repoFor('strict-missing')
    seedGenre(repo, 'memo')
    repo.appendMessage({
      id: 'm-strict-missing',
      genre: 'memo',
      payload: { a: 1 },
      actor: { id: 'u1', role: 'genesis_admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })

    const result = await processDocketMessage(repo, 'm-strict-missing', DEV_SEAL_CONTEXT, { lawMode: 'strict' })
    expect(result.finalState).toBe('rejected')
    expect(result.reason).toContain('missing-routing')
    repo.close()
  })
})
