import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { existsSync, unlinkSync } from 'node:fs'
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
  const file = `.tmp-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  tempFiles.add(file)
  const repo = new SqliteArchiveRepository(file)
  repo.initialize()
  repo.migrate()
  seedBaseline(repo, ['secret-memorial', 'joint-memorial', 'urgent-dispatch', 'petition', 'notice', 'dispatch', 'errata'])
  return repo
}

function archiveSeed(repo: SqliteArchiveRepository, message: Record<string, unknown>): void {
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

function seedBaseline(repo: SqliteArchiveRepository, genres: string[]): void {
  const seedActor = { id: 'seed', role: 'genesis_admin' }
  const seedMeta = { constitutional: true }
  const now = new Date().toISOString()
  archiveSeed(repo, {
    id: `edict-admission-${Date.now()}`,
    genre: 'edict',
    payload: { law_type: 'admission', version: '1.0.0', content: { allowed_genres: ['*'] }, precedence: 0, effective_date: now },
    actor: seedActor,
    submittedAt: now,
    metadata: seedMeta,
  })
  archiveSeed(repo, {
    id: `edict-appointment-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'appointment',
      version: '1.0.0',
      content: { roles: { admin: { permissions: ['draft', 'review', 'authorize'], allowed_genres: ['*'] } } },
      precedence: 0,
      effective_date: now,
    },
    actor: seedActor,
    submittedAt: now,
    metadata: seedMeta,
  })
  archiveSeed(repo, {
    id: `edict-routing-${Date.now()}`,
    genre: 'edict',
    payload: { law_type: 'routing', version: '1.0.0', content: { table: {}, broadcast_policy: 'hierarchical' }, precedence: 0, effective_date: now },
    actor: seedActor,
    submittedAt: now,
    metadata: seedMeta,
  })
  archiveSeed(repo, {
    id: `edict-classification-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'classification',
      version: '1.0.0',
      content: { levels: ['open', 'inner', 'secret', 'top'], hierarchy: 'strict', compartmentalization: true },
      precedence: 0,
      effective_date: now,
    },
    actor: seedActor,
    submittedAt: now,
    metadata: seedMeta,
  })
  archiveSeed(repo, {
    id: `edict-protocol-${Date.now()}`,
    genre: 'edict',
    payload: { law_type: 'protocol', version: '1.0.0', content: { required_acks_by_genre: {} }, precedence: 0, effective_date: now },
    actor: seedActor,
    submittedAt: now,
    metadata: seedMeta,
  })
  for (const genre of genres) {
    archiveSeed(repo, {
      id: `ti-${genre}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      genre: 'ti_definition',
      payload: { target_genre: genre, version: '1.0.0', schema: { type: 'object', required: [] } },
      actor: seedActor,
      submittedAt: now,
      metadata: seedMeta,
    })
  }
}

describe('Ritual 8: Secret Memorial (Mifeng)', () => {
  it('keeps encrypted payload opaque while processing seals', async () => {
    const repo = repoFor('mifeng')
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT)

    const ciphertext = 'enc:v1:Q2lwaGVydGV4dA=='
    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `msg-${randomUUID()}`,
        genre: 'secret-memorial',
        payload: { blob: ciphertext, encrypted: true },
        actor: { id: 'censorate_01', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: { clearance: 'top' },
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as { id: string }
    const status = await (await app.request(`/messages/${body.id}`)).json() as { message: { payload: { blob: string } }; seals: unknown[] }

    expect(status.message.payload.blob).toBe(ciphertext)
    expect(status.seals).toHaveLength(6)
    repo.close()
  })
})

describe('Ritual 9: Joint Memorial (Huiti)', () => {
  it('requires all listed offices before final authorization', async () => {
    const repo = repoFor('huiti')
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT)

    const id = `msg-${randomUUID()}`
    const submit = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id,
        genre: 'joint-memorial',
        payload: { routing: { destination: ['office_a', 'office_b', 'office_c'], clearance: 'secret' } },
        actor: { id: 'hanlin_joint', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })
    expect(submit.status).toBe(201)

    const a = await app.request(`/messages/${id}/approvals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ office: 'office_a' }) })
    expect(a.status).toBe(200)
    const aBody = await a.json() as { state: string }
    expect(aBody.state).toBe('pending')

    await app.request(`/messages/${id}/approvals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ office: 'office_b' }) })
    const c = await app.request(`/messages/${id}/approvals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ office: 'office_c' }) })
    const cBody = await c.json() as { state: string }
    expect(cBody.state).toBe('archived')

    repo.close()
  })
})

describe('Ritual 10: Imperial Audience (Streaming)', () => {
  it('publishes state changes quickly to stream consumers', async () => {
    const repo = repoFor('audience')
    const channel = new ReliableChannel()
    const app = buildGateway(repo, channel, DEV_SEAL_CONTEXT)

    const id = `msg-${randomUUID()}`
    const start = Date.now()
    await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id,
        genre: 'urgent-dispatch',
        payload: { msg: 'north frontier breach' },
        actor: { id: 'war_ministry', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    const stream = await app.request('/stream')
    const body = await stream.json() as { events: Array<{ messageId: string; at: string }> }
    const found = body.events.find((e) => e.messageId === id)
    expect(found).toBeTruthy()
    expect(Date.now() - start).toBeLessThan(1000)

    repo.close()
  })
})

describe('Ritual 11: Return to Sender (Bohui)', () => {
  it('preserves audit trail for rejected memorial and revision resubmission', async () => {
    const repo = repoFor('bohui')
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT)

    const baseId = `msg-${randomUUID()}`
    const bad = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: baseId,
        genre: 'petition',
        payload: {},
        actor: { id: 'origin_office', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })
    expect(bad.status).toBe(201)

    const v2Id = `${baseId}-v2`
    const good = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: v2Id,
        genre: 'petition',
        payload: { corrected: true },
        actor: { id: 'origin_office', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: { revisionOf: baseId },
      }),
    })
    expect(good.status).toBe(201)

    const first = await (await app.request(`/messages/${baseId}`)).json() as { state: string; transitions: Array<{ reason?: string }> }
    const second = await (await app.request(`/messages/${v2Id}`)).json() as { state: string }

    expect(first.state).toBe('rejected')
    expect(first.transitions.some((t) => t.reason === 'empty-payload')).toBe(true)
    expect(second.state).toBe('archived')

    repo.close()
  })
})

describe('Ritual 14: Censorate Circulation (Kechao)', () => {
  it('supports broadcast fan-out intent with routable destinations', async () => {
    const repo = repoFor('kechao')
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT)

    const id = `msg-${randomUUID()}`
    const submit = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id,
        genre: 'notice',
        payload: { routing: { destination: ['ministry_a', 'ministry_b'], broadcast: true } },
        actor: { id: 'imperial_secretariat', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })
    expect(submit.status).toBe(201)

    await app.request(`/messages/${id}/approvals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ office: 'ministry_a' }) })
    const final = await app.request(`/messages/${id}/approvals`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ office: 'ministry_b' }) })
    const finalBody = await final.json() as { state: string }
    expect(finalBody.state).toBe('archived')

    repo.close()
  })
})

describe('Ritual 16: Errata Slip (Gaiding)', () => {
  it('keeps original immutable and links amendment by supersedes pointer', async () => {
    const repo = repoFor('gaiding')
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT)

    const originalId = `msg-${randomUUID()}`
    await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: originalId,
        genre: 'dispatch',
        payload: { recipient: 'wrong-ministry' },
        actor: { id: 'secretariat', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    const amendmentId = `${originalId}-amendment`
    await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: amendmentId,
        genre: 'errata',
        payload: { recipient: 'correct-ministry' },
        actor: { id: 'secretariat', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: { supersedes: originalId },
      }),
    })

    const original = await (await app.request(`/messages/${originalId}`)).json() as { message: { payload: Record<string, unknown> } }
    const amendment = await (await app.request(`/messages/${amendmentId}`)).json() as { message: { metadata?: Record<string, unknown> } }

    expect(original.message.payload.recipient).toBe('wrong-ministry')
    expect(amendment.message.metadata?.supersedes).toBe(originalId)

    repo.close()
  })
})
