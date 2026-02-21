import { afterEach, describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildGateway } from '../../gateway/src/index'
import { SqliteArchiveRepository } from '../../archive/src/sqlite'
import { ReliableChannel } from '../../channel/src/index'
import { DEV_SEAL_CONTEXT } from '../../seal/src/index'
import { createEmptyOffice, applyGenesisFromDir } from '../../genesis/src/index'
import type { MessageEnvelope } from '../../core/src/index'

const tempDirs = new Set<string>()
const THREE_IMPERIAL = { ...DEV_SEAL_CONTEXT, imperialSignatures: ['sig-1', 'sig-2', 'sig-3'] }

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  tempDirs.clear()
})

function baseMessage(id: string, genre: string, payload: Record<string, unknown>, actorRole = 'genesis_admin', metadata: Record<string, unknown> = {}): MessageEnvelope {
  return {
    id,
    genre,
    payload,
    actor: { id: 'ritual-actor', role: actorRole },
    submittedAt: new Date().toISOString(),
    metadata,
  }
}

async function setupOffice(name: string): Promise<{ repo: SqliteArchiveRepository; app: ReturnType<typeof buildGateway> }> {
  const dir = mkdtempSync(join(tmpdir(), `wenyan-ritual-06-${name}-`))
  tempDirs.add(dir)
  await createEmptyOffice(dir)
  await applyGenesisFromDir(dir)
  const repo = new SqliteArchiveRepository(resolve(dir, "wenyan.dang'an"))
  repo.initialize()
  repo.migrate()
  const app = buildGateway(repo, new ReliableChannel(), THREE_IMPERIAL, {
    lawMode: 'strict',
    distributedMode: 'consort',
    nodeId: 'beijing',
  })
  return { repo, app }
}

async function submit(app: ReturnType<typeof buildGateway>, message: MessageEnvelope): Promise<Response> {
  return app.request('/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  })
}

function authHeaders(actorId: string, role: string): Record<string, string> {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      sub: actorId,
      role,
      iss: 'wenyan.local',
      aud: 'wenyan-gateway',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url')
  const signature = createHmac('sha256', 'wenyan-local-jwt-secret').update(`${header}.${payload}`).digest('base64url')
  return { authorization: `Bearer ${header}.${payload}.${signature}` }
}

async function waitForState(
  app: ReturnType<typeof buildGateway>,
  id: string,
  expected: string,
  timeoutMs = 5000,
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const res = await app.request(`/messages/${id}`, {
      headers: authHeaders('ritual-actor', 'genesis_admin'),
    })
    if (res.status === 200) {
      const json = await res.json() as { state?: string }
      if (json.state === expected) return
      if (json.state === 'rejected' && expected !== 'rejected') {
        throw new Error(`message ${id} rejected while waiting for ${expected}`)
      }
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 50))
  }
  throw new Error(`timeout waiting for ${id} -> ${expected}`)
}

async function ensureGenre(app: ReturnType<typeof buildGateway>, genre: string, required: string[] = []): Promise<void> {
  const id = `ti-${genre}-${Date.now()}`
  const res = await submit(
    app,
    baseMessage(id, 'ti_definition', {
      target_genre: genre,
      version: '1.0.0',
      schema: { type: 'object', required },
    }),
  )
  expect(res.status).toBe(202)
  await waitForState(app, id, 'archived')
}

async function seedAccessControl(app: ReturnType<typeof buildGateway>): Promise<void> {
  const id = `ac-${Date.now()}`
  const law = baseMessage(id, 'edict', {
    law_type: 'access_control',
    version: '1.0.0',
    content: {
      read_permissions: {
        clerk: ['tax_record'],
        genesis_admin: ['*'],
      },
      anonymous_read: false,
      query_hash_only: true,
    },
    precedence: 100,
    effective_date: new Date().toISOString(),
  })
  expect((await submit(app, law)).status).toBe(202)
  await waitForState(app, id, 'archived')
}

describe('Wenyan v0.6.0 rituals', () => {
  it('Ritual 1: provides trace view for archived lifecycle', async () => {
    const { repo, app } = await setupOffice('trace')
    await ensureGenre(app, 'petition', ['title'])
    const msg = baseMessage('r06-trace-1', 'petition', { title: 'observe' })
    expect((await submit(app, msg)).status).toBe(202)

    const trace = await app.request(`/audit/trace/${msg.id}`)
    const json = await trace.json() as { spans: Array<{ name: string }> }
    expect(trace.status).toBe(200)
    expect(json.spans.some((s) => s.name.includes('caoni'))).toBe(true)
    repo.close()
  })

  it('Ritual 2: Seal 0 records authorized reader access', async () => {
    const { repo, app } = await setupOffice('seal0')
    await ensureGenre(app, 'tax_record', ['year'])
    await seedAccessControl(app)

    const doc = baseMessage('tax-1645', 'tax_record', { year: 1645, amount: 12 })
    expect((await submit(app, doc)).status).toBe(202)
    await waitForState(app, doc.id, 'archived')

    const read = await app.request(`/messages/${doc.id}`, {
      headers: authHeaders('clerk-1', 'clerk'),
    })
    expect(read.status).toBe(200)

    const whoRead = await app.request(`/audit/who-read?document=${doc.id}`)
    const whoReadJson = await whoRead.json() as { items: Array<{ actor_id: string; signature: string }> }
    expect(whoReadJson.items.length).toBeGreaterThan(0)
    expect(whoReadJson.items[0].actor_id).toBe('clerk-1')
    expect(whoReadJson.items[0].signature.length).toBeGreaterThan(0)
    repo.close()
  })

  it('Ritual 3: high-velocity constitutional submissions trigger quarantine', async () => {
    const { repo, app } = await setupOffice('velocity')
    for (let i = 0; i < 11; i += 1) {
      const r = await submit(
        app,
        baseMessage(`ti-vel-${i}`, 'ti_definition', {
          target_genre: `g-${i}`,
          version: '1.0.0',
          schema: { type: 'object' },
        }),
      )
      expect(r.status).toBe(202)
    }

    const blocked = await submit(
      app,
      baseMessage('ti-vel-blocked', 'ti_definition', {
        target_genre: 'g-blocked',
        version: '1.0.0',
        schema: { type: 'object' },
      }),
    )
    expect(blocked.status).toBe(202)

    let items: Array<{ alertType: string }> = []
    const started = Date.now()
    while (Date.now() - started < 5000) {
      const anomaly = await app.request('/audit/anomaly?type=velocity')
      const json = await anomaly.json() as { items: Array<{ alertType: string }> }
      items = json.items
      if (items.length > 0) break
      await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 50))
    }
    expect(items.length).toBeGreaterThan(0)
    repo.close()
  })

  it('Ritual 4: temporal anomaly is rejected and logged', async () => {
    const { repo, app } = await setupOffice('temporal')
    await ensureGenre(app, 'dispatch', ['title'])
    const past = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const res = await submit(
      app,
      baseMessage('temporal-1', 'dispatch', { title: 'backdated' }, 'genesis_admin', { claimed_timestamp: past }),
    )
    expect(res.status).toBe(422)

    const anomaly = await app.request('/audit/anomaly?type=temporal_anomaly')
    const json = await anomaly.json() as { items: Array<{ alertType: string }> }
    expect(json.items.length).toBeGreaterThan(0)
    repo.close()
  })

  it('Ritual 5: geographic impossibility triggers rejection and alert', async () => {
    const { repo, app } = await setupOffice('geo')
    await ensureGenre(app, 'dispatch', ['title'])
    const res = await submit(
      app,
      baseMessage('geo-1', 'dispatch', { title: 'travel' }, 'genesis_admin', {
        geography: {
          actor_id: 'ritual-actor',
          from: 'Beijing',
          to: 'Nanjing',
          distance_km: 1000,
          delta_seconds: 1,
        },
      }),
    )
    expect(res.status).toBe(422)

    const anomaly = await app.request('/audit/anomaly?type=geographic_impossibility')
    const json = await anomaly.json() as { items: Array<{ alertType: string }> }
    expect(json.items.length).toBeGreaterThan(0)
    repo.close()
  })

  it('Ritual 6: coalition anomaly emits warning alert', async () => {
    const { repo, app } = await setupOffice('coalition')
    await ensureGenre(app, 'petition', ['title'])
    const res = await submit(
      app,
      baseMessage('coalition-1', 'petition', { title: 'suspicious approvals' }, 'genesis_admin', {
        coalition: {
          genre: 'petition',
          offices: ['censorate', 'war_ministry'],
          observed_probability: 0.95,
          baseline_probability: 0.05,
        },
      }),
    )
    expect(res.status).toBe(202)

    const anomaly = await app.request('/audit/anomaly?type=coalition')
    const json = await anomaly.json() as { items: Array<{ alertType: string }> }
    expect(json.items.length).toBeGreaterThan(0)
    repo.close()
  })

  it('Ritual 7: audit export returns checkpoint bundle with digest', async () => {
    const { repo, app } = await setupOffice('export')
    await ensureGenre(app, 'petition', ['title'])
    expect((await submit(app, baseMessage('exp-1', 'petition', { title: 'exportable' }))).status).toBe(202)

    const checkpoint = await app.request('/audit/checkpoint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'all', signatures: ['sig-1', 'sig-2', 'sig-3'], sealCount: 3 }),
    })
    expect(checkpoint.status).toBe(201)

    const exported = await app.request('/audit/export')
    const json = await exported.json() as { checkpoint?: { merkleRoot: string }; digest?: string }
    expect(exported.status).toBe(200)
    expect(json.checkpoint?.merkleRoot).toBeDefined()
    expect(json.digest).toBeDefined()
    repo.close()
  })

  it('Ritual 8: unauthorized read attempt is denied and logged', async () => {
    const { repo, app } = await setupOffice('blind-read')
    await ensureGenre(app, 'tax_record', ['year'])
    await ensureGenre(app, 'military_dispatch', ['title'])
    await seedAccessControl(app)

    const secret = baseMessage('mil-1', 'military_dispatch', { title: 'secret order' })
    expect((await submit(app, secret)).status).toBe(202)
    await waitForState(app, secret.id, 'archived')

    const denied = await app.request(`/messages/${secret.id}`, {
      headers: authHeaders('clerk-2', 'clerk'),
    })
    expect(denied.status).toBe(403)

    const whoRead = await app.request('/audit/who-read?genre=military_dispatch')
    const json = await whoRead.json() as { items: Array<{ result_status: string }> }
    expect(json.items.some((x) => x.result_status === 'denied')).toBe(true)
    repo.close()
  })

  it('Ritual 9: tracing and audit path stays within bounded overhead', async () => {
    const { repo, app } = await setupOffice('perf')
    await ensureGenre(app, 'petition', ['title'])

    const count = 80
    const started = Date.now()
    for (let i = 0; i < count; i += 1) {
      const res = await submit(app, baseMessage(`perf-${i}`, 'petition', { title: `p-${i}` }))
      expect(res.status).toBe(202)
    }
    const elapsed = Date.now() - started
    expect(elapsed).toBeLessThan(10_000)
    repo.close()
  })
})
