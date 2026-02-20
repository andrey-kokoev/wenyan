import { describe, expect, it } from 'vitest'
import { ErpBridgeAdapter } from './erp-http'
import { PayrollBridgeAdapter } from './payroll-http'
import { RegulatoryBridgeAdapter } from './regulatory-mqtt'

const baseActor = { id: 'a', role: 'bridge_adapter' }

describe('imperial works bridge adapters', () => {
  it('translate outbound deterministically', async () => {
    const erp = new ErpBridgeAdapter({ id: 'erp', protocol: 'erp', endpoint: 'https://erp.local', target_genre: 'material_request', trust_provenance: true })
    const payroll = new PayrollBridgeAdapter({ id: 'pay', protocol: 'payroll', endpoint: 'https://bank.local', target_genre: 'payment_receipt', trust_provenance: true })
    const reg = new RegulatoryBridgeAdapter({ id: 'reg', protocol: 'regulatory', url: 'mqtt://gov.local', target_genre: 'inspection_scheduled', trust_provenance: true })

    await erp.start({ archive: {} as never, onInbound: async () => undefined })
    await payroll.start({ archive: {} as never, onInbound: async () => undefined })
    await reg.start({ archive: {} as never, onInbound: async () => undefined })

    expect((await erp.publishOutbound({ id: 'm1', genre: 'material_request', payload: { material_spec: 'stone', quantity: 5, vendor_id: 'v1' }, actor: baseActor, submittedAt: new Date().toISOString(), metadata: {} })).foreignId).toContain('erp:')
    expect((await payroll.publishOutbound({ id: 'm2', genre: 'completion_report', payload: { worker_id: 'w1', amount: 10 }, actor: baseActor, submittedAt: new Date().toISOString(), metadata: {} })).foreignId).toContain('payroll:')
    expect((await reg.publishOutbound({ id: 'm3', genre: 'safety_incident', payload: { severity: 'critical', location: 'A1' }, actor: baseActor, submittedAt: new Date().toISOString(), metadata: {} })).foreignId).toContain('regulatory:')
  })
})
