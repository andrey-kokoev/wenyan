import { describe, expect, it } from 'vitest'
import { buildGateway } from './index'
import { InMemoryArchiveRepository } from '@wenyan/archive'
import { ReliableChannel } from '@wenyan/channel'
import { DEV_SEAL_CONTEXT } from '@wenyan/seal'

function seedAdmissionLaw(repo: InMemoryArchiveRepository, allowedGenres: string[]): void {
  const now = new Date().toISOString()
  repo.appendMessage({
    id: 'edict-admission',
    genre: 'edict',
    payload: {
      law_type: 'admission',
      version: '1.0.0',
      content: { allowed_genres: allowedGenres },
      precedence: 0,
      effective_date: now,
    },
    actor: { id: 'seed', role: 'admin' },
    submittedAt: now,
    metadata: {},
  })
  repo.appendTransition({
    messageId: 'edict-admission',
    fromState: 'pending',
    toState: 'archived',
    sequenceNo: 1,
    actorId: 'seed',
    sealedAt: now,
    prevTransitionHash: 'GENESIS',
    at: now,
  })
}

function seedTiDefinition(repo: InMemoryArchiveRepository, targetGenre: string): void {
  const now = new Date().toISOString()
  const id = `ti-${targetGenre}-${Date.now()}`
  repo.appendMessage({
    id,
    genre: 'ti_definition',
    payload: {
      target_genre: targetGenre,
      version: '1.0.0',
      schema: { type: 'object', required: [] },
    },
    actor: { id: 'seed', role: 'admin' },
    submittedAt: now,
    metadata: {},
  })
  repo.appendTransition({
    messageId: id,
    fromState: 'pending',
    toState: 'archived',
    sequenceNo: 1,
    actorId: 'seed',
    sealedAt: now,
    prevTransitionHash: 'GENESIS',
    at: now,
  })
}

describe('gateway boundaries', () => {
  it('rejects malformed payload with 400 (zod)', async () => {
    const app = buildGateway(new InMemoryArchiveRepository(), new ReliableChannel(), DEV_SEAL_CONTEXT)
    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bad: true }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid-payload')
  })

  it('rejects valid payload with invalid seal context as 403', async () => {
    const badSealContext = {
      ...DEV_SEAL_CONTEXT,
      draftPublicKeyHex: 'f'.repeat(64),
    }

    const app = buildGateway(new InMemoryArchiveRepository(), new ReliableChannel(), badSealContext)
    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `m-${Date.now()}`,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('invalid-seal-chain')
  })

  it('fails closed in strict mode when admission law is missing', async () => {
    const repo = new InMemoryArchiveRepository()
    seedTiDefinition(repo, 'memo')
    const app = buildGateway(
      repo,
      new ReliableChannel(),
      DEV_SEAL_CONTEXT,
      { lawMode: 'strict' },
    )
    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `m-${Date.now()}`,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('law-missing-admission')
  })

  it('enforces admission law genre allow-list', async () => {
    const repo = new InMemoryArchiveRepository()
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
        actor: { id: 'u1', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('genre-not-admitted')
  })

  it('applies updated admission law immediately after edict archive', async () => {
    const repo = new InMemoryArchiveRepository()
    seedTiDefinition(repo, 'memo')
    seedAdmissionLaw(repo, ['petition'])
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, {
      lawMode: 'compat',
      lawCacheTtlSeconds: 3600,
    })

    const blocked = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `m-blocked-${Date.now()}`,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })
    expect(blocked.status).toBe(403)

    const edictRes = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `edict-admission-update-${Date.now()}`,
        genre: 'edict',
        payload: {
          law_type: 'admission',
          version: '2.0.0',
          content: { allowed_genres: ['petition', 'memo'] },
          precedence: 1,
          effective_date: new Date().toISOString(),
          superseded_edict_id: 'edict-admission',
        },
        actor: { id: 'u1', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })
    expect(edictRes.status).toBe(201)

    const allowed = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `m-allowed-${Date.now()}`,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })
    expect(allowed.status).toBe(201)
  })

  it('rejects undefined genre schema in strict mode', async () => {
    const repo = new InMemoryArchiveRepository()
    seedAdmissionLaw(repo, ['*'])
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { lawMode: 'strict' })

    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `m-${Date.now()}`,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('genre-schema-missing')
  })
})
