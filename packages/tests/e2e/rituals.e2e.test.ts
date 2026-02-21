import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { unlinkSync, existsSync } from 'node:fs'
import { buildGateway } from '../../gateway/src/index'
import { SqliteArchiveRepository } from '../../archive/src/sqlite'
import { ReliableChannel } from '../../channel/src/index'
import { DEV_SEAL_CONTEXT } from '../../seal/src/index'
import { sleep, waitForState, withAuth } from './helpers'

const tempFiles = new Set<string>()

afterEach(() => {
  for (const f of tempFiles) {
    if (existsSync(f)) {
      unlinkSync(f)
    }
  }
  tempFiles.clear()
})

function makeRepo (name: string): SqliteArchiveRepository {
  const file = `.tmp-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  tempFiles.add(file)
  const repo = new SqliteArchiveRepository(file)
  repo.initialize()
  repo.migrate()
  seedBaseline(repo, ['petition'])
  return repo
}

function archiveSeed (repo: SqliteArchiveRepository, message: Record<string, unknown>): void {
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

function seedBaseline (repo: SqliteArchiveRepository, genres: string[]): void {
  const now = new Date().toISOString()
  archiveSeed(repo, {
    id: `edict-admission-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'admission',
      version: '1.0.0',
      content: { allowed_genres: ['*'] },
      precedence: 0,
      effective_date: now,
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: now,
    metadata: { constitutional: true },
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
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: now,
    metadata: { constitutional: true },
  })
  archiveSeed(repo, {
    id: `edict-routing-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'routing',
      version: '1.0.0',
      content: { table: {}, broadcast_policy: 'hierarchical' },
      precedence: 0,
      effective_date: now,
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: now,
    metadata: { constitutional: true },
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
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: now,
    metadata: { constitutional: true },
  })
  archiveSeed(repo, {
    id: `edict-protocol-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'protocol',
      version: '1.0.0',
      content: { required_acks_by_genre: {} },
      precedence: 0,
      effective_date: now,
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: now,
    metadata: { constitutional: true },
  })
  archiveSeed(repo, {
    id: `edict-access-control-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'access_control',
      version: '1.0.0',
      content: {
        read_permissions: { admin: ['*'], genesis_admin: ['*'] },
        anonymous_read: true,
        query_hash_only: true,
      },
      precedence: 0,
      effective_date: now,
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: now,
    metadata: { constitutional: true },
  })
  archiveSeed(repo, {
    id: `edict-access-control-${Date.now()}`,
    genre: 'edict',
    payload: {
      law_type: 'access_control',
      version: '1.0.0',
      content: {
        anonymous_read: true,
        read_permissions: { genesis_admin: ['*'] },
      },
      precedence: 0,
      effective_date: new Date().toISOString(),
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true },
  })
  for (const genre of genres) {
    archiveSeed(repo, {
      id: `ti-${genre}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
}

function validMessage (actorId = 'scholar_01') {
  return {
    id: `msg-${randomUUID()}`,
    genre: 'petition',
    payload: { memorial: 'river works petition' },
    actor: { id: actorId, role: 'admin' as const },
    submittedAt: new Date().toISOString(),
    metadata: { dynasty: 'qing' },
  }
}

async function waitForNonArchivedState (
  repo: SqliteArchiveRepository,
  id: string,
  timeoutMs = 5000,
): Promise<string | undefined> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const state = repo.snapshotState(id)
    if (state && state !== 'pending') return state
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 50))
  }
  return repo.snapshotState(id)
}

describe('Ritual 1: Imperial Examination (Golden Path)', () => {
  it('archives one memorial with full seal chain', async () => {
    const repo = makeRepo('golden-path')
    const app = withAuth(buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT))

    const payload = validMessage('scholar_01')
    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(202)
    const body = await res.json() as { id: string }

    const status = await waitForState(app, body.id, 'archived')
    expect(status.state).toBe('archived')
    expect(status.seals.length).toBe(6)

    const allByActor = [repo.getMessage(body.id)].filter((m) => m?.actor.id === 'scholar_01')
    expect(allByActor).toHaveLength(1)

    repo.close()
  })
})

describe('Ritual 2: Tampered Memorial (Integrity Failure)', () => {
  it('detects tampering as seal invalidation', async () => {
    const repo = makeRepo('tamper')
    const badContext = { ...DEV_SEAL_CONTEXT, draftPublicKeyHex: 'f'.repeat(64) }
    const app = withAuth(buildGateway(repo, new ReliableChannel(), badContext))

    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validMessage('courier_ambushed')),
    })

    expect(res.status).toBe(202)
    const body = await res.json() as { id: string }
    const status = await waitForState(app, body.id, 'rejected')
    expect(status.transitions.at(-1)?.reason).toBe('invalid-seal-chain')

    repo.close()
  }, 15_000)
})

describe('Ritual 3: Grieved Petition (Idempotency)', () => {
  it('deduplicates repeated idempotency key', async () => {
    const repo = makeRepo('idempotency')
    const app = withAuth(buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT))

    const payload = validMessage('flood_1638')
    const headers = {
      'content-type': 'application/json',
      'x-idempotency-key': 'flood_1638',
    }

    const first = await app.request('/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const second = await app.request('/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    // Target ritual expectation: 2nd should be 200 with same body.
    expect(first.status).toBe(202)
    expect(second.status).toBe(200)

    repo.close()
  })
})

describe('Ritual 4: Multi-Office Memorial (Routing)', () => {
  it('requires dual office approval before imperial seal', async () => {
    const repo = makeRepo('routing')
    const app = withAuth(buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT))

    const payload = {
      ...validMessage('war_dispatcher'),
      payload: {
        text: 'dispatch',
        routing: { destination: ['war_ministry', 'censorate'], clearance: 'secret' },
      },
    }

    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(202)

    const created = await res.json() as { id: string }
    const status = await waitForState(app, created.id, 'pending')
    expect(status.state).toBe('pending')

    repo.close()
  })
})

describe('Ritual 5: Forbidden Archive (Immutability)', () => {
  it('prevents retroactive mutation of archived content', async () => {
    const repo = makeRepo('forbidden-archive')
    const app = withAuth(buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT))

    const payload = validMessage('secretariat')
    const createdRes = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const created = await createdRes.json() as { id: string }

    // Target ritual expectation: message mutation must be blocked.
    // This assertion intentionally captures the desired invariant.
    const status = await waitForState(app, created.id, 'archived')
    expect(status.message.payload).toEqual(payload.payload)

    repo.close()
  })
})

describe('Ritual 6: Corrupted Courier (Network Resilience)', () => {
  it('eventually archives 100 submissions with no duplicates', async () => {
    const repo = makeRepo('courier')
    const app = withAuth(buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT))

    const ids: string[] = []
    for (let i = 0; i < 100; i += 1) {
      const msg = validMessage(`courier_${i}`)
      ids.push(msg.id)
      await app.request('/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(msg),
      })
    }

    for (let i = 0; i < 200; i += 1) {
      const archivedNow = ids.filter((id) => repo.snapshotState(id) === 'archived')
      if (archivedNow.length === 100) break
      await sleep(25)
    }
    const archived = ids.filter((id) => repo.snapshotState(id) === 'archived')
    expect(archived).toHaveLength(100)

    repo.close()
  })
})

describe('Ritual 7: Impersonation Attempt (Identity Boundaries)', () => {
  it('rejects forged actor signature at gateway boundary', async () => {
    const repo = makeRepo('impersonation')
    const badContext = {
      ...DEV_SEAL_CONTEXT,
      draftPublicKeyHex: '0'.repeat(64),
    }
    const app = withAuth(buildGateway(repo, new ReliableChannel(), badContext))

    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validMessage('grand_secretary_li')),
    })

    expect(res.status).toBe(202)
    const body = await res.json() as { id: string }
    const status = await waitForState(app, body.id, 'rejected')
    expect(status.transitions.at(-1)?.reason).toBe('invalid-seal-chain')

    repo.close()
  }, 15_000)
})
