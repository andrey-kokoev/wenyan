import { describe, expect, it } from 'vitest'
import { connect, StringCodec } from 'nats'
import { NatsServerBuilder } from 'nats-memory-server'
import { NatsBridgeAdapter } from './adapters/nats'

describe('nats adapter integration', () => {
  it('consumes subscribed messages and forwards into bridge context', async () => {
    const natsServer = await NatsServerBuilder.create().build().start()
    const natsUrl = natsServer.getUrl()
    const adapter = new NatsBridgeAdapter({
      id: 'nats-it',
      protocol: 'nats',
      url: natsUrl,
      subject_pattern: ['events.*'],
      target_genre: 'edict',
      idempotency_header: 'Nats-Msg-Id',
      trust_provenance: true,
    })
    const seen: string[] = []
    try {
      await adapter.start({
        archive: {} as never,
        onInbound: async (_adapter, payload) => {
          const p = payload as { data?: { value?: string } }
          if (p.data?.value) seen.push(p.data.value)
        },
      })

      const nc = await connect({ servers: natsUrl })
      const sc = StringCodec()
      nc.publish('events.bridge', sc.encode(JSON.stringify({ value: 'ok' })))
      await new Promise((resolve) => setTimeout(resolve, 100))
      await nc.drain()
    } finally {
      await adapter.stop()
      await natsServer.stop()
    }

    expect(seen).toContain('ok')
  })
})
