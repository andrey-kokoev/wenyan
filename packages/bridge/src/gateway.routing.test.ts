import { afterEach, describe, expect, it } from 'vitest'
import { parseBootstrapConfig } from '@wenyan/core'
import { BridgeGateway } from './gateway'
import type { ArchiveRepository } from '@wenyan/archive'
import type { AdapterContext, BridgeAdapter, FromWenyan, IntoWenyan } from './types'
import type { MessageEnvelope } from '@wenyan/core'

class NullInto implements IntoWenyan<unknown> {
  translate(): never {
    throw new Error('not-used')
  }
  extractIdempotencyKey(): string {
    return 'x'
  }
  async verifyProvenance(): Promise<boolean> {
    return true
  }
}
class NullFrom implements FromWenyan<unknown> {
  translate(): unknown {
    return {}
  }
  reconcile(local: unknown): unknown {
    return local
  }
}

class TestAdapter implements BridgeAdapter {
  readonly into = new NullInto() as IntoWenyan<unknown>
  readonly from = new NullFrom() as FromWenyan<unknown>
  readonly config
  readonly id
  private ctx: AdapterContext | undefined
  constructor(public readonly protocol: 'nats' | 'kafka' | 'mqtt', id: string, target = 'edict') {
    this.id = id
    this.config = { id, protocol, target_genre: target, trust_provenance: true } as BridgeAdapter['config']
  }
  async start(ctx: AdapterContext): Promise<void> {
    this.ctx = ctx
  }
  async stop(): Promise<void> {
    this.ctx = undefined
  }
  async health(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
  async publishOutbound(_document: MessageEnvelope): Promise<{ foreignId: string }> {
    return { foreignId: `${this.id}:ok` }
  }
}

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('bridge outbound routing', () => {
  it('queues outbound events only for matching adapter protocol target', async () => {
    const enqueued: string[] = []
    const archive = {
      getCurrentTiDefinition: async () => ({ messageId: 'ti-1', targetGenre: 'edict', version: '1.0.0', schema: {}, sealedAt: new Date().toISOString() }),
      enqueueBridgeOutbound: async (adapterId: string) => {
        enqueued.push(adapterId)
      },
      dequeueBridgeOutbound: async () => [],
    } as unknown as ArchiveRepository

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/stream')) {
        return new Response(
          JSON.stringify({ events: [{ at: new Date().toISOString(), type: 'archive.appended', messageId: 'm-1' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/messages/m-1')) {
        return new Response(
          JSON.stringify({
            message: {
              id: 'm-1',
              genre: 'edict',
              payload: {},
              actor: { id: 'a', role: 'genesis_admin' },
              submittedAt: new Date().toISOString(),
              metadata: { routing: { foreign_system: 'kafka' } },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof globalThis.fetch

    const bootstrap = parseBootstrapConfig({
      archive: { engine: 'sqlite', path: './x.db' },
      genesis: { node_id: '00000000-0000-4000-8000-0000000000aa', genesis_key: 'x' },
      gateway: { listen: { host: '127.0.0.1', port: 8787 } },
      bridge: {
        enabled: true,
        sync: { mode: 'push', poll_interval_ms: 1000, batch_size: 10 },
        adapters: [
          { id: 'n1', protocol: 'nats', url: 'nats://127.0.0.1:4222', subject_pattern: ['events.*'], target_genre: 'edict', idempotency_header: 'Nats-Msg-Id', trust_provenance: true },
          { id: 'k1', protocol: 'kafka', brokers: ['127.0.0.1:9092'], topics: ['events'], consumer_group: 'g1', target_genre: 'edict', trust_provenance: true },
        ],
      },
    })

    const bridge = new BridgeGateway({ bootstrap, archive, adapters: [new TestAdapter('nats', 'n1'), new TestAdapter('kafka', 'k1')] })
    await bridge.start()
    const result = await bridge.syncOnce()
    await bridge.stop()

    expect(result.pushed).toBe(0)
    expect(enqueued.length).toBeGreaterThan(0)
    expect(enqueued.every((id) => id === 'k1')).toBe(true)
  })
})
