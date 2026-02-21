import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, unlinkSync } from 'node:fs'
import { createHmac } from 'node:crypto'
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

function seedAccessControl(repo: SqliteArchiveRepository): void {
  archiveMessage(repo, {
    id: `edict-access-control-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'access_control',
      version: '1.0.0',
      content: {
        anonymous_read: false,
        read_permissions: {
          genesis_admin: ['*'],
        },
      },
      precedence: 0,
      effective_date: new Date().toISOString(),
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true },
  })
}

function issueJwt(sub: string, role: string, secret = 'test-secret'): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      role,
      iss: 'wenyan.local',
      aud: 'wenyan-gateway',
      iat: now,
      exp: now + 300,
    }),
  ).toString('base64url')
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
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

  it('denies spoofed actor headers when header auth mode is disabled', async () => {
    const repo = repoFor('spoof-header-deny')
    seedTiDefinition(repo, 'memo')
    seedAdmissionLaw(repo, ['memo'])
    seedAccessControl(repo)
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, {
      lawMode: 'strict',
      auth: {
        jwtIssuer: 'wenyan.local',
        jwtAudience: 'wenyan-gateway',
        jwtAlg: 'HS256',
        jwtSecret: 'test-secret',
        allowHeaderActor: false,
      },
    })
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

  it('denies invalid jwt token and allows valid jwt token', async () => {
    const repo = repoFor('jwt-auth')
    seedTiDefinition(repo, 'memo')
    seedAdmissionLaw(repo, ['memo'])
    seedAccessControl(repo)
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, {
      lawMode: 'strict',
      auth: {
        jwtIssuer: 'wenyan.local',
        jwtAudience: 'wenyan-gateway',
        jwtAlg: 'HS256',
        jwtSecret: 'test-secret',
        allowHeaderActor: false,
      },
    })
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

    const bad = await app.request(`/messages/${id}`, {
      headers: { authorization: 'Bearer not-a-jwt' },
    })
    expect(bad.status).toBe(403)

    const good = await app.request(`/messages/${id}`, {
      headers: { authorization: `Bearer ${issueJwt('reader-1', 'genesis_admin')}` },
    })
    expect(good.status).toBe(200)
    repo.close()
  })

  it('returns 503 for mesh routes when distributed runtime is disabled', async () => {
    const app = buildGateway(repoFor('mesh-disabled'), new ReliableChannel(), DEV_SEAL_CONTEXT, {
      lawMode: 'strict',
      distributedMode: 'single',
    })
    const status = await app.request('/mesh/status')
    expect(status.status).toBe(503)
    const root = await app.request('/mesh/merkle-root')
    expect(root.status).toBe(503)
    const join = await app.request('/mesh/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ peer: 'gossip://peer:7946' }),
    })
    expect(join.status).toBe(503)
  })

  it('exposes /stream as SSE and /stream/replay as json replay', async () => {
    const app = buildGateway(repoFor('stream-contract'), new ReliableChannel(), DEV_SEAL_CONTEXT)
    const stream = await app.request('/stream')
    expect(stream.status).toBe(200)
    expect(stream.headers.get('content-type')).toContain('text/event-stream')
    const replay = await app.request('/stream/replay')
    expect(replay.status).toBe(200)
    const body = await replay.json()
    expect(Array.isArray(body.events)).toBe(true)
  })
})
