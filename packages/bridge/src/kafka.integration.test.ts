import { describe, expect, it } from 'vitest'
import { KafkaBridgeAdapter } from './adapters/kafka'

describe('kafka adapter integration', () => {
  it('accepts simulated inbound payload and reports healthy lifecycle', async () => {
    const adapter = new KafkaBridgeAdapter({
      id: 'kafka-it',
      protocol: 'kafka',
      brokers: ['127.0.0.1:9092'],
      topics: ['events'],
      consumer_group: 'wenyan-it',
      target_genre: 'edict',
      trust_provenance: true,
      metadata_mode: 'strict',
    })

    const seen: Array<Record<string, unknown>> = []
    await adapter.start({
      archive: {} as never,
      onInbound: async (_adapter, payload) => {
        const p = payload as { value?: Record<string, unknown> }
        if (p.value) seen.push(p.value)
      },
    })

    const health = await adapter.health()
    expect(health.ok).toBe(true)

    await adapter.simulateInbound(
      {
        topic: 'events',
        partition: 0,
        offset: '42',
        value: { amount: 1 },
        headers: { 'x-id': '42' },
      },
      {
        archive: {} as never,
        onInbound: async (_adapter, payload) => {
          const p = payload as { value?: Record<string, unknown> }
          if (p.value) seen.push(p.value)
        },
      },
    )

    const outbound = await adapter.publishOutbound({
      id: 'doc-1',
      genre: 'edict',
      payload: { amount: 2 },
      actor: { id: 'bridge', role: 'bridge_adapter' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })

    expect(outbound.foreignId).toContain('edict')
    expect(seen.length).toBe(1)

    await adapter.stop()
    const stopped = await adapter.health()
    expect(stopped.ok).toBe(false)
  })
})
