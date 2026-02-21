import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import { buildGateway } from './index'
import { SqliteArchiveRepository } from '@andrey-kokoev/wenyan-archive/sqlite'
import { ReliableChannel } from '@andrey-kokoev/wenyan-channel'
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

function seedAccessControl(repo: SqliteArchiveRepository): void {
  archiveMessage(repo, {
    id: `edict-access-control-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'access_control',
      version: '1.0.0',
      content: {
        read_permissions: {
          clerk: ['memo'],
          genesis_admin: ['*'],
        },
        anonymous_read: false,
        query_hash_only: true,
      },
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

  it('rejects read request when access_control law is missing', async () => {
    const repo = repoFor('read-law-missing')
    seedTiDefinition(repo, 'memo')
    seedAdmissionLaw(repo, ['memo'])
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { lawMode: 'strict' })

    const id = `m-${Date.now()}`
    const submit = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })
    expect(submit.status).toBe(202)
    const read = await app.request(`/messages/${id}`)
    expect(read.status).toBe(403)
    const body = await read.json()
    expect(body.error).toBe('forbidden')
    repo.close()
  })

  it('denies spoofed actor headers when header auth mode is disabled', async () => {
    const repo = repoFor('spoof-headers')
    seedTiDefinition(repo, 'memo')
    seedAdmissionLaw(repo, ['memo'])
    seedAccessControl(repo)
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { lawMode: 'strict' })

    const id = `m-${Date.now()}`
    const submit = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })
    expect(submit.status).toBe(202)

    const read = await app.request(`/messages/${id}`, {
      headers: {
        'x-wenyan-actor-id': 'spoofed-user',
        'x-wenyan-actor-role': 'genesis_admin',
      },
    })
    expect(read.status).toBe(403)
    repo.close()
  })

  it('denies invalid JWT bearer token', async () => {
    const repo = repoFor('invalid-jwt')
    seedTiDefinition(repo, 'memo')
    seedAdmissionLaw(repo, ['memo'])
    seedAccessControl(repo)
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { lawMode: 'strict' })

    const id = `m-${Date.now()}`
    const submit = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })
    expect(submit.status).toBe(202)

    const read = await app.request(`/messages/${id}`, {
      headers: {
        authorization: 'Bearer not-a-jwt',
      },
    })
    expect(read.status).toBe(403)
    repo.close()
  })
})
