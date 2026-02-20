import { describe, expect, it } from 'vitest'
import { MqttBridgeAdapter } from './adapters/mqtt'

const runIntegration = process.env.RUN_MQTT_INTEGRATION === '1'
const suite = runIntegration ? describe : describe.skip

suite('mqtt adapter integration', () => {
  it('accepts simulated inbound payload and reports healthy lifecycle', async () => {
    const adapter = new MqttBridgeAdapter({
      id: 'mqtt-it',
      protocol: 'mqtt',
      url: 'mqtt://127.0.0.1:1883',
      topics: ['greenhouse/+/data'],
      qos: 1,
      target_genre: 'edict',
      trust_provenance: true,
      metadata_mode: 'strict',
    })

    const seen: Array<Record<string, unknown>> = []
    await adapter.start({
      archive: {} as never,
      onInbound: async (_adapter, payload) => {
        const p = payload as { payload?: Record<string, unknown> }
        if (p.payload) seen.push(p.payload)
      },
    })

    expect((await adapter.health()).ok).toBe(true)

    await adapter.simulateInbound(
      {
        topic: 'greenhouse/a/data',
        payload: { temp: 22.5 },
        qos: 1,
        retain: true,
        headers: { retain: '1' },
      },
      {
        archive: {} as never,
        onInbound: async (_adapter, payload) => {
          const p = payload as { payload?: Record<string, unknown> }
          if (p.payload) seen.push(p.payload)
        },
      },
    )

    const outbound = await adapter.publishOutbound({
      id: 'doc-2',
      genre: 'sensor_reading',
      payload: { humidity: 65 },
      actor: { id: 'bridge', role: 'bridge_adapter' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })

    expect(outbound.foreignId).toContain('sensor_reading')
    expect(seen.length).toBeGreaterThan(0)

    await adapter.stop()
    expect((await adapter.health()).ok).toBe(false)
  })
})
