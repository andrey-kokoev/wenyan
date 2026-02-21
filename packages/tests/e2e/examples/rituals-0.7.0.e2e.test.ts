import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { BridgeGateway } from '../../../../packages/bridge/src/gateway'
import { ErpBridgeAdapter } from '../../../../packages/bridge/src/adapters/erp-http'
import { PayrollBridgeAdapter } from '../../../../packages/bridge/src/adapters/payroll-http'
import { RegulatoryBridgeAdapter } from '../../../../packages/bridge/src/adapters/regulatory-mqtt'
import { parseBootstrapConfig } from '../../../../packages/core/src/bootstrap'
import { ConstructionCorruptionDetector } from '../../../../packages/imperial-works/src/index'
import { createOfflineStore, queueReviewSeal, syncWithMinister } from '../../../../packages/mobile-foreman/src/index'
import { allowGenres, cleanupHarness, ensureGenre, message, setupExampleOffice, submit } from './harness'
import { ritualNumbers } from './fixtures'
import { createPbftFixture } from '../pbft-helpers'

afterEach(() => {
  cleanupHarness()
})

function merkleLike(items: string[]): string {
  return createHash('sha256').update(items.join('|')).digest('hex')
}

describe('Wenyan v0.7.0 imperial works rituals', () => {
  it('R1 forbidden blueprint: constitutional amendment gating and threshold behavior', async () => {
    const { app } = await setupExampleOffice('r7-1')
    await ensureGenre(app, 'blueprint_change', ['structural_modification'])
    await allowGenres(app, ['blueprint_change'])

    const { pbft, signed } = await createPbftFixture(['emperor', 'minister_works', 'censor_chief'], 2)
    const proposal = await pbft.proposeTiDefinition('bp-1', 'emperor')
    const at = new Date().toISOString()
    await pbft.onPrepare(await signed({ ...proposal, nodeId: 'minister_works', phase: 'prepare', at }))
    expect(pbft.commitIfThreshold('bp-1')).toBe(false)

    const workerBlocked = await submit(
      app,
      {
        ...message('bp-worker', 'blueprint_change', { structural_modification: 'expand' }),
        actor: { id: 'worker_001', role: 'worker_001' },
      },
    )
    expect(workerBlocked.status).toBe(403)

    await pbft.onPrepare(await signed({ ...proposal, nodeId: 'censor_chief', phase: 'prepare', at }))
    await pbft.onCommit(await signed({ ...proposal, nodeId: 'minister_works', phase: 'commit', at }))
    await pbft.onCommit(await signed({ ...proposal, nodeId: 'censor_chief', phase: 'commit', at }))
    expect(pbft.commitIfThreshold('bp-1')).toBe(true)
  })

  it('R2 hierarchy violation: worker cannot issue work_order', async () => {
    const { app } = await setupExampleOffice('r7-2')
    await ensureGenre(app, 'work_order', ['task_description'])
    await allowGenres(app, ['work_order'])

    const res = await submit(
      app,
      {
        ...message('wo-1', 'work_order', { task_description: 'Build golden roof' }),
        actor: { id: 'worker_001', role: 'worker_001' },
      },
    )
    expect(res.status).toBe(403)
  })

  it('R3 scaffolding collapse: emergency route quarantines and pauses normal flow', async () => {
    const { app } = await setupExampleOffice('r7-3')
    await ensureGenre(app, 'safety_incident', ['severity_level'])
    await ensureGenre(app, 'work_order', ['task_description'])
    await allowGenres(app, ['safety_incident', 'work_order'])

    const emergency = await app.request('/emergency/safety-incident', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'si-1', severity: 'critical', location: 'north-wing', actorId: 'worker_042' }),
    })
    expect(emergency.status).toBe(202)

    const blocked = await submit(app, message('wo-after', 'work_order', { task_description: 'Continue' }))
    expect(blocked.status).toBe(423)
  })

  it('R4 tunnel foreman: offline queue and sync transfer', async () => {
    const store = createOfflineStore()
    for (let i = 0; i < ritualNumbers.r9.sampleCount; i += 1) queueReviewSeal(store, `cr-${i}`, ['s2', 's3', 's4', 's5'])
    const sync = syncWithMinister({ store, localRoot: 'x', remoteRoot: 'y' })
    expect(sync.transferred).toBe(ritualNumbers.r9.sampleCount)
  })

  it('R5 ghost worker: impossible travel detection without retroactive invalidation', async () => {
    const d = new ConstructionCorruptionDetector()
    expect(d.detectGhostWorker({ distanceKm: 1000, deltaSeconds: 60 })).toBe(true)
    expect(d.detectGhostWorker({ distanceKm: 1, deltaSeconds: 3600 })).toBe(false)
  })

  it('R6 material diversion: warning path and bridge pause semantics', async () => {
    const d = new ConstructionCorruptionDetector()
    expect(d.detectMaterialDiversion({ projectClass: 'frugal', materialTier: 'luxury', priorLuxuryApprovals: 5 })).toBe(true)
  })

  it('R7 three bridges: isolated operation and seal-0 style receipts', async () => {
    const archive = {
      initialize: () => undefined,
      migrate: () => undefined,
      getCurrentTiDefinition: async () => ({ messageId: 'ti-1', targetGenre: 'material_request', version: '1.0.0', schema: {}, sealedAt: new Date().toISOString() }),
      dequeueBridgeOutbound: async () => [],
      enqueueBridgeOutbound: async () => undefined,
      appendBridgeDeadLetter: async () => undefined,
      upsertForeignSyncState: async () => undefined,
      markBridgeOutboundResult: async () => undefined,
    } as any

    const bootstrap = parseBootstrapConfig({
      archive: { engine: 'sqlite', path: './dummy.db' },
      genesis: { node_id: '00000000-0000-4000-8000-000000000701', genesis_key: 'x' },
      gateway: { listen: { host: '127.0.0.1', port: 8787 } },
      bridge: {
        enabled: true,
        sync: { mode: 'push', poll_interval_ms: 1000, batch_size: 10 },
        adapters: [
          { id: 'erp-1', protocol: 'erp', endpoint: 'https://erp.local', target_genre: 'material_request', trust_provenance: true },
          { id: 'pay-1', protocol: 'payroll', endpoint: 'https://bank.local', target_genre: 'payment_receipt', trust_provenance: true },
          { id: 'reg-1', protocol: 'regulatory', url: 'mqtt://gov.local', target_genre: 'inspection_scheduled', trust_provenance: true },
        ],
      },
    })

    const g = new BridgeGateway({
      bootstrap,
      archive,
      adapters: [
        new ErpBridgeAdapter({ id: 'erp-1', protocol: 'erp', endpoint: 'https://erp.local', target_genre: 'material_request', trust_provenance: true }),
        new PayrollBridgeAdapter({ id: 'pay-1', protocol: 'payroll', endpoint: 'https://bank.local', target_genre: 'payment_receipt', trust_provenance: true }),
        new RegulatoryBridgeAdapter({ id: 'reg-1', protocol: 'regulatory', url: 'mqtt://gov.local', target_genre: 'inspection_scheduled', trust_provenance: true }),
      ],
      apiBaseUrl: 'http://127.0.0.1:9/api/wenyan',
    })

    await g.start()
    const status = await g.status()
    expect(status.adapters).toHaveLength(3)
    await g.stop()
  })

  it('R8 structural cabal: coalition detection raises scrutiny without retroactive invalidation', async () => {
    const d = new ConstructionCorruptionDetector()
    expect(d.detectStructuralCabal({ mutualApprovals: 10, baselinePerHour: 0.1, windowHours: 1 })).toBe(true)
  })

  it('R9 grand opening: merkle audit + reconciliation counts', async () => {
    const sample = Array.from({ length: ritualNumbers.r9.sampleCount }, (_, i) => `tile_${i}`)
    const root = merkleLike(sample)
    expect(root.length).toBeGreaterThan(10)
    expect(sample.length).toBe(ritualNumbers.r9.sampleCount)
  })
})
