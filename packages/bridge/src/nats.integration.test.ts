import { describe, expect, it } from 'vitest'
import { connect, StringCodec } from 'nats'
import { NatsBridgeAdapter } from './adapters/nats'

const runIntegration = process.env.RUN_NATS_INTEGRATION === '1'
const suite = runIntegration ? describe : describe.skip

suite('nats adapter integration', () => {
  it('consumes subscribed messages and forwards into bridge context', async () => {
    const adapter = new NatsBridgeAdapter({
      id: 'nats-it',
      protocol: 'nats',
      url: process.env.NATS_URL ?? 'nats://127.0.0.1:4222',
      subject_pattern: ['events.*'],
      target_genre: 'edict',
      idempotency_header: 'Nats-Msg-Id',
      trust_provenance: true,
    })
    const seen: string[] = []
    await adapter.start({
      archive: {} as never,
      onInbound: async (_adapter, payload) => {
        const p = payload as { data?: { value?: string } }
        if (p.data?.value) seen.push(p.data.value)
      },
    })

    const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://127.0.0.1:4222' })
    const sc = StringCodec()
    nc.publish('events.bridge', sc.encode(JSON.stringify({ value: 'ok' })))
    await new Promise((resolve) => setTimeout(resolve, 100))
    await nc.drain()
    await adapter.stop()

    expect(seen).toContain('ok')
  })
})
