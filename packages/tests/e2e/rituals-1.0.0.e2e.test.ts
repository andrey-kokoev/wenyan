import { afterEach, describe, expect, it } from 'vitest'
import { unlinkSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { buildGateway } from '../../gateway/src/index'
import { SqliteArchiveRepository } from '../../archive/src/sqlite'
import { ReliableChannel } from '../../channel/src/index'
import { DEV_SEAL_CONTEXT } from '../../seal/src/index'

const tempFiles = new Set<string>()

afterEach(() => {
  for (const f of tempFiles) {
    if (existsSync(f)) unlinkSync(f)
  }
  tempFiles.clear()
})

function repoFor(name: string): SqliteArchiveRepository {
  const file = `.tmp-v1-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  tempFiles.add(file)
  const repo = new SqliteArchiveRepository(file)
  repo.initialize()
  repo.migrate()
  seed(repo, ['petition'])
  return repo
}

function archiveSeed(repo: SqliteArchiveRepository, message: Record<string, unknown>) {
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

function seed(repo: SqliteArchiveRepository, genres: string[]) {
  const now = new Date().toISOString()
  archiveSeed(repo, {
    id: `edict-admission-${Date.now()}`,
    genre: 'edict',
    payload: { law_type: 'admission', version: '1.0.0', content: { allowed_genres: ['*'] }, precedence: 0, effective_date: now },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: now,
    metadata: { constitutional: true },
  })
  archiveSeed(repo, {
    id: `edict-access-${Date.now()}`,
    genre: 'edict',
    payload: { law_type: 'access_control', version: '1.0.0', content: { anonymous_read: true, read_permissions: { genesis_admin: ['*'] } }, precedence: 0, effective_date: now },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: now,
    metadata: { constitutional: true },
  })
  archiveSeed(repo, {
    id: `edict-protocol-${Date.now()}`,
    genre: 'edict',
    payload: { law_type: 'protocol', version: '1.0.0', content: { required_acks_by_genre: {} }, precedence: 0, effective_date: now },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: now,
    metadata: { constitutional: true },
  })
  for (const genre of genres) {
    archiveSeed(repo, {
      id: `ti-${genre}-${Date.now()}`,
      genre: 'ti_definition',
      payload: { target_genre: genre, version: '1.0.0', schema: { type: 'object', required: [] } },
      actor: { id: 'seed', role: 'genesis_admin' },
      submittedAt: now,
      metadata: { constitutional: true },
    })
  }
}

describe('Wenyan v1.0 rituals', () => {
  it('rejects oversized header payloads at Tongzheng Si boundary', async () => {
    const repo = repoFor('header-cap')
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { lawMode: 'strict' })

    const res = await app.request('/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-huge': 'x'.repeat(9000),
      },
      body: JSON.stringify({
        id: `msg-${randomUUID()}`,
        genre: 'petition',
        payload: { memorial: 'x' },
        actor: { id: 'a1', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(431)
    expect(await res.json()).toMatchObject({ error: 'headers-too-large' })
    repo.close()
  })

  it('preserves stable API path for submission and query', async () => {
    const repo = repoFor('api-freeze')
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { lawMode: 'strict' })

    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `msg-${randomUUID()}`,
        genre: 'petition',
        payload: { memorial: 'stable' },
        actor: { id: 'a2', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(202)
    const body = await res.json() as { id: string }
    const status = await app.request(`/messages/${body.id}`)
    expect(status.status).toBe(200)
    repo.close()
  })
})
