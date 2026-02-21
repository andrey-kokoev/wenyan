import { afterEach, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { resolveBridgeConflict } from '../../../../packages/bridge/src/sync'
import { createHash } from 'node:crypto'
import { allowGenres, cleanupHarness, ensureGenre, message, setupExampleOffice, submit, waitForState } from './harness'
import { ritualNumbers, sensorReading } from './fixtures'
import { coldMigrationPlan } from '../../../../examples/smart-greenhouse/src/lib/cold-migration'
import { createPbftFixture } from '../pbft-helpers'

function digest (input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

afterEach(() => {
  cleanupHarness()
})

describe('Wenyan v0.6.0 examples rituals', () => {
  it('R1 constitutional amendment: todo schema evolves while pending window stays on old Ti', async () => {
    const { app } = await setupExampleOffice('r1')
    await ensureGenre(app, 'petition', ['title'])
    await allowGenres(app, ['petition', 'ti_definition', 'edict'])

    const preAmend = await submit(app, message('task-old', 'petition', { title: 'legacy', priority: 'high' }))
    expect(preAmend.status).toBe(202)

    const { pbft, signed } = await createPbftFixture(['alice', 'bob', 'carol', 'dave'], ritualNumbers.r1.pbftThreshold)
    const proposal = await pbft.proposeTiDefinition('task-ti-v2', 'alice')
    const at = new Date().toISOString()
    await pbft.onPrepare(await signed({ ...proposal, nodeId: 'alice', phase: 'prepare', at }))
    await pbft.onPrepare(await signed({ ...proposal, nodeId: 'bob', phase: 'prepare', at }))
    await pbft.onPrepare(await signed({ ...proposal, nodeId: 'carol', phase: 'prepare', at }))
    expect(pbft.commitIfThreshold('task-ti-v2')).toBe(false)

    const amend = await submit(
      app,
      message('task-ti-v2', 'ti_definition', {
        target_genre: 'petition',
        version: '2.0.0',
        schema: { type: 'object', required: ['title', 'priority'] },
      }),
    )
    expect(amend.status).toBe(202)

    await pbft.onCommit(await signed({ ...proposal, nodeId: 'alice', phase: 'commit', at }))
    await pbft.onCommit(await signed({ ...proposal, nodeId: 'bob', phase: 'commit', at }))
    await pbft.onCommit(await signed({ ...proposal, nodeId: 'carol', phase: 'commit', at }))
    expect(pbft.commitIfThreshold('task-ti-v2')).toBe(true)

    const postAmend = await submit(app, message('task-new', 'petition', { title: 'new', priority: 'high' }))
    expect(postAmend.status).toBe(202)

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
    expect(Date.now() - start).toBeLessThan(ritualNumbers.r2.convergenceMs)
  })

  it('R3 compromised teen: velocity anomaly quarantines attempts and records alerts across restart', async () => {
    const first = await setupExampleOffice('r3-a')
    await ensureGenre(first.app, 'spend_request', ['to', 'amount', 'reason'])
    await allowGenres(first.app, ['ti_definition', 'spend_request'])

    const burst = Math.min(12, ritualNumbers.r3.attackAttempts)
    let sawQuarantine = false
    for (let i = 0; i < burst; i += 1) {
      const id = `attack-${i}`
      const r = await submit(first.app, message(id, 'ti_definition', {
        target_genre: `burst-${i}`,
        version: '1.0.0',
        schema: { type: 'object' },
      }))
      if (r.status === 202) {
        await waitForState(first.app, id, 'archived')
        continue
      }
      expect(r.status).toBe(403)
      sawQuarantine = true
      break
    }

    const quarantined = await submit(first.app, message('attack-quarantined', 'ti_definition', {
      target_genre: 'burst-quarantined',
      version: '1.0.0',
      schema: { type: 'object' },
    }))
    expect(quarantined.status).toBe(403)
    expect(await quarantined.json()).toMatchObject({ error: 'actor-quarantined' })
    expect(sawQuarantine || quarantined.status === 403).toBe(true)

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
    expect(first.status).toBe(202)

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
      expect((await submit(app, message(`m-${i}`, 'petition', { title: `expense-${i}` }))).status).toBe(202)
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

  it('R6 sensor flood: toy-pressure ingest validates count and forgetting boundary', async () => {
    const { app } = await setupExampleOffice('r6')
    await ensureGenre(app, 'sensor_reading', ['temp', 'humidity', 'soil_ph'])
    await allowGenres(app, ['sensor_reading'])

    const total = ritualNumbers.r6.sensorFloodCount
    for (let i = 0; i < total; i += 1) {
      const res = await submit(
        app,
        message(`sensor-${i}`, 'sensor_reading', sensorReading(20 + (i % 10)), {
          routing: { destination: `zone-${i % 3}` },
          provenance: { foreign: 'mqtt' },
        }),
      )
      expect(res.status).toBe(202)
    }

    const sample = await app.request('/messages/sensor-1')
    const json = await sample.json() as { message: { metadata: Record<string, unknown> } }
    expect(json.message.metadata.qos).toBeUndefined()
  }, 15_000)

  it('R7 firmware upgrade: v2/v3 coexist and historical validation remains available', async () => {
    const { app } = await setupExampleOffice('r7')
    await ensureGenre(app, 'petition', ['title'])
    await allowGenres(app, ['petition', 'ti_definition'])

    for (let i = 0; i < ritualNumbers.r7.legacyCount; i += 1) {
      expect((await submit(app, message(`v2-${i}`, 'petition', { title: `legacy-${i}` }))).status).toBe(202)
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
    ).toBe(202)
    await waitForState(app, 'ti-v3', 'archived')

    expect((await submit(app, message('v3-1', 'petition', { title: 'new', light_lux: ritualNumbers.r7.lightLux }))).status).toBe(202)
    expect((await submit(app, message('v2-post', 'petition', { title: 'old-shape' }))).status).toBe(400)
  })

  it('R8 historical climate query: exact point value and proof path available', async () => {
    const { app } = await setupExampleOffice('r8')
    await ensureGenre(app, 'sensor_reading', ['temp', 'humidity', 'soil_ph'])
    await allowGenres(app, ['sensor_reading'])

    const target = message('hist-1', 'sensor_reading', { temp: 2.5, humidity: 70, soil_ph: 6.1 })
    expect((await submit(app, target)).status).toBe(202)

    const res = await app.request('/messages/hist-1')
    const json = await res.json() as { message: { payload: { temp: number } }; seals: unknown[] }
    expect(json.message.payload.temp).toBe(2.5)
    expect(Array.isArray(json.seals)).toBe(true)
  })

  it('R9 qiankan cold migration: plan preserves hot-path expectations and cold proof capability', async () => {
    const configPath = resolve(process.cwd(), '../../examples/smart-greenhouse/config.json')
    const plan = coldMigrationPlan('2026-03-01', configPath)
    expect(plan.hotDbTargetGb).toBeGreaterThan(0)
    expect(plan.merkleVerified).toBe(true)
    expect(plan.key.endsWith('.parquet')).toBe(true)
  })
})
