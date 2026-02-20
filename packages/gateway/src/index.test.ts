import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import { buildGateway } from './index'
import { SqliteArchiveRepository } from '@wenyan/archive/sqlite'
import { ReliableChannel } from '@wenyan/channel'
import { DEV_SEAL_CONTEXT } from '@wenyan/seal'

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
  const file = `.tmp-gateway-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  tempFiles.add(file)
  const repo = new SqliteArchiveRepository(file)
  repo.initialize()
  repo.migrate()
  return repo
}

function archiveMessage(repo: SqliteArchiveRepository, message: Record<string, unknown>) {
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

function seedTiDefinition(repo: SqliteArchiveRepository, targetGenre: string): void {
  archiveMessage(repo, {
    id: `ti-${targetGenre}-${Date.now()}`,
    genre: 'ti_definition',
    payload: {
      target_genre: targetGenre,
      version: '1.0.0',
      schema: { type: 'object', required: [] },
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true },
  })
}

function seedAdmissionLaw(repo: SqliteArchiveRepository, allowedGenres: string[]): void {
  archiveMessage(repo, {
    id: `edict-admission-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'admission',
      version: '1.0.0',
      content: { allowed_genres: allowedGenres },
      precedence: 0,
      effective_date: new Date().toISOString(),
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true },
  })
}

describe('gateway boundaries', () => {
  it('rejects malformed payload with 400 (zod)', async () => {
    const app = buildGateway(repoFor('bad-payload'), new ReliableChannel(), DEV_SEAL_CONTEXT)
    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bad: true }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid-payload')
  })

  it('rejects undefined genre schema in strict mode with Schema Undefined contract', async () => {
    const repo = repoFor('schema-undefined')
    seedAdmissionLaw(repo, ['*'])
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { lawMode: 'strict' })

    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `m-${Date.now()}`,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('Schema Undefined')
    expect(body.genre).toBe('memo')
    repo.close()
  })

  it('enforces admission allow-list when Ti exists', async () => {
    const repo = repoFor('allow-list')
    seedTiDefinition(repo, 'memo')
    seedAdmissionLaw(repo, ['petition'])
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { lawMode: 'strict' })

    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `m-${Date.now()}`,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('genre-not-admitted')
    repo.close()
  })
})
