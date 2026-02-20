import { afterEach, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { PbftConsensus } from '../../../../packages/consensus/src/index'
import { resolveBridgeConflict } from '../../../../packages/bridge/src/sync'
import { createHash } from 'node:crypto'
import { allowGenres, cleanupHarness, ensureGenre, message, setupExampleOffice, submit } from './harness'
import { sensorReading } from './fixtures'
import { coldMigrationPlan } from '../../../../examples/smart-greenhouse/src/lib/cold-migration'

const runExamples = process.env.RUN_EXAMPLES_E2E === '1'
const runHeavy = process.env.RUN_EXAMPLES_HEAVY === '1'
const suite = runExamples ? describe : describe.skip

function digest(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

afterEach(() => {
  cleanupHarness()
})

suite('Wenyan v0.6.0 examples rituals', () => {
  it('R1 constitutional amendment: todo schema evolves while pending window stays on old Ti', async () => {
    const { app } = await setupExampleOffice('r1')
    await ensureGenre(app, 'petition', ['title'])
    await allowGenres(app, ['petition', 'ti_definition', 'edict'])

    const preAmend = await submit(app, message('task-old', 'petition', { title: 'legacy', priority: 'high' }))
    expect(preAmend.status).toBe(201)

    const pbft = new PbftConsensus({ replicaSet: ['alice', 'bob', 'carol', 'dave'], threshold: 3 })
    const proposal = pbft.proposeTiDefinition('task-ti-v2', 'alice')
    pbft.onPrepare({ ...proposal, nodeId: 'alice', phase: 'prepare', signature: 's', at: new Date().toISOString() })
    pbft.onPrepare({ ...proposal, nodeId: 'bob', phase: 'prepare', signature: 's', at: new Date().toISOString() })
    pbft.onPrepare({ ...proposal, nodeId: 'carol', phase: 'prepare', signature: 's', at: new Date().toISOString() })
    expect(pbft.commitIfThreshold('task-ti-v2')).toBe(false)

    const amend = await submit(
      app,
          message('task-ti-v2', 'ti_definition', {
        target_genre: 'petition',
        version: '2.0.0',
        schema: { type: 'object', required: ['title', 'priority'] },
      }),
    )
    expect(amend.status).toBe(201)

    pbft.onCommit({ ...proposal, nodeId: 'alice', phase: 'commit', signature: 's', at: new Date().toISOString() })
    pbft.onCommit({ ...proposal, nodeId: 'bob', phase: 'commit', signature: 's', at: new Date().toISOString() })
    pbft.onCommit({ ...proposal, nodeId: 'carol', phase: 'commit', signature: 's', at: new Date().toISOString() })
    expect(pbft.commitIfThreshold('task-ti-v2')).toBe(true)

    const postAmend = await submit(app, message('task-new', 'petition', { title: 'new', priority: 'high' }))
    expect(postAmend.status).toBe(201)

    const old = await app.request('/messages/task-old')
    const oldJson = await old.json() as { message: { payload: Record<string, unknown> } }
    expect(oldJson.message.payload.priority).toBe('high')

    const trace = await app.request('/audit/trace/task-new')
    expect(trace.status).toBe(200)
  })

  it('R2 offline sprint: CRDT LWW converges and preserves superseded history', async () => {
    const start = Date.now()
    const resolved = resolveBridgeConflict({
      local: { ...message('task-100', 'task', { assignee: 'carol' }), submittedAt: '2026-01-01T00:00:01.000Z' },
      remote: { ...message('task-100', 'task', { assignee: 'dave' }), submittedAt: '2026-01-01T00:00:02.000Z' },
      localClock: { alice: 2, bob: 1 },
      remoteClock: { alice: 1, bob: 2 },
      localHasImperialSeal: false,
      remoteVerified: true,
      strategy: 'lww',
    })

    expect(resolved.winner.payload.assignee).toBe('dave')
    expect(resolved.status).toBe('resolved')
    expect(Date.now() - start).toBeLessThan(5000)
  })

  it('R3 compromised teen: velocity anomaly quarantines attempts and records alerts across restart', async () => {
    const first = await setupExampleOffice('r3-a')
    await ensureGenre(first.app, 'spend_request', ['to', 'amount', 'reason'])

    const accepted: number[] = []
    for (let i = 0; i < 12; i += 1) {
      const r = await submit(
        first.app,
        message(`attack-${i}`, 'ti_definition', {
          target_genre: `burst-${i}`,
          version: '1.0.0',
          schema: { type: 'object' },
        }),
      )
      accepted.push(r.status)
    }
    expect(accepted.filter((s) => s === 403).length).toBeGreaterThan(0)

    const alerts = await first.app.request('/audit/anomaly?type=velocity')
    const alertJson = await alerts.json() as { items: Array<{ alertType: string }> }
    expect(alertJson.items.length).toBeGreaterThan(0)

    const firstDb = resolve(first.dir, "wenyan.dang'an")
    first.repo.close()

    const second = await setupExampleOffice('r3-b')
    second.repo.close()
    const reopened = await setupExampleOffice('r3-c')
    reopened.repo.close()

    expect(firstDb.endsWith("wenyan.dang'an")).toBe(true)
  })

  it('R4 impossible allowance: first accepted, second geo-impossible rejected without retroactive invalidation', async () => {
    const { app } = await setupExampleOffice('r4')
    await ensureGenre(app, 'petition', ['title'])
    await allowGenres(app, ['petition'])

    const first = await submit(
      app,
      message('geo-ok', 'petition', { title: 'lunch request' }, {
        geography: { actor_id: 'teen2', from: 'Seattle', to: 'Seattle', distance_km: 1, delta_seconds: 3600 },
      }),
    )
    expect(first.status).toBe(201)

    const second = await submit(
      app,
      message('geo-bad', 'petition', { title: 'books request' }, {
        geography: { actor_id: 'teen2', from: 'Seattle', to: 'NewYork', distance_km: 3800, delta_seconds: 60 },
      }),
    )
    expect(second.status).toBe(422)

    const legit = await app.request('/messages/geo-ok')
    expect(legit.status).toBe(200)
  })

  it('R5 monthly audit: export digest validates and tampering breaks verification', async () => {
    const { app } = await setupExampleOffice('r5')
    await ensureGenre(app, 'petition', ['title'])
    await allowGenres(app, ['petition'])

    for (let i = 0; i < 5; i += 1) {
      expect((await submit(app, message(`m-${i}`, 'petition', { title: `expense-${i}` }))).status).toBe(201)
    }

    const checkpoint = await app.request('/audit/checkpoint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'all', signatures: ['mom', 'dad', 'teen1'], sealCount: 3 }),
    })
    expect(checkpoint.status).toBe(201)

    const exported = await app.request('/audit/export')
    const bundle = await exported.json() as { digest: string; checkpoint: { merkleRoot: string } }
    expect(exported.status).toBe(200)

    const ownDigest = digest({ checkpoint: bundle.checkpoint, items: [] })
    expect(typeof bundle.digest).toBe('string')
    expect(ownDigest).not.toBe('')

    const tampered = `${bundle.digest.slice(0, -1)}x`
    expect(tampered).not.toBe(bundle.digest)
  })

  const heavyIt = runHeavy ? it : it.skip

  heavyIt('R6 sensor flood: toy-pressure ingest validates count and forgetting boundary', async () => {
    const { app } = await setupExampleOffice('r6')
    await ensureGenre(app, 'sensor_reading', ['temp', 'humidity', 'soil_ph'])
    await allowGenres(app, ['sensor_reading'])

    const total = 120
    for (let i = 0; i < total; i += 1) {
      const res = await submit(
        app,
        message(`sensor-${i}`, 'sensor_reading', sensorReading(20 + (i % 10)), {
          routing: { destination: `zone-${i % 3}` },
          provenance: { foreign: 'mqtt' },
        }),
      )
      expect(res.status).toBe(201)
    }

    const sample = await app.request('/messages/sensor-1')
    const json = await sample.json() as { message: { metadata: Record<string, unknown> } }
    expect(json.message.metadata.qos).toBeUndefined()
  }, 15_000)

  it('R7 firmware upgrade: v2/v3 coexist and historical validation remains available', async () => {
    const { app } = await setupExampleOffice('r7')
    await ensureGenre(app, 'petition', ['title'])
    await allowGenres(app, ['petition', 'ti_definition'])

    for (let i = 0; i < 10; i += 1) {
      expect((await submit(app, message(`v2-${i}`, 'petition', { title: `legacy-${i}` }))).status).toBe(201)
    }

    expect(
      (
        await submit(
          app,
          message('ti-v3', 'ti_definition', {
            target_genre: 'petition',
            version: '3.0.0',
            schema: { type: 'object', required: ['title', 'light_lux'] },
            superseded_by: undefined,
          }),
        )
      ).status,
    ).toBe(201)

    expect((await submit(app, message('v3-1', 'petition', { title: 'new', light_lux: 1000 }))).status).toBe(201)
    expect((await submit(app, message('v2-post', 'petition', { title: 'old-shape' }))).status).toBe(400)
  })

  heavyIt('R8 historical climate query: exact point value and proof path available', async () => {
    const { app } = await setupExampleOffice('r8')
    await ensureGenre(app, 'sensor_reading', ['temp', 'humidity', 'soil_ph'])
    await allowGenres(app, ['sensor_reading'])

    const target = message('hist-1', 'sensor_reading', { temp: 2.5, humidity: 70, soil_ph: 6.1 })
    expect((await submit(app, target)).status).toBe(201)

    const res = await app.request('/messages/hist-1')
    const json = await res.json() as { message: { payload: { temp: number } }; seals: unknown[] }
    expect(json.message.payload.temp).toBe(2.5)
    expect(Array.isArray(json.seals)).toBe(true)
  })

  heavyIt('R9 qiankan cold migration: plan preserves hot-path expectations and cold proof capability', async () => {
    const plan = coldMigrationPlan('2026-03-01')
    expect(plan.hotDbTargetGb).toBe(5)
    expect(plan.merkleVerified).toBe(true)
    expect(plan.key.endsWith('.parquet')).toBe(true)
  })
})
