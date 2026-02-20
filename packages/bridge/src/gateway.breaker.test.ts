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

class FailingAdapter implements BridgeAdapter {
  readonly protocol = 'nats' as const
  readonly id = 'n1'
  readonly config = {
    id: 'n1',
    protocol: 'nats',
    url: 'nats://127.0.0.1:4222',
    subject_pattern: ['events.*'],
    target_genre: 'edict',
    idempotency_header: 'Nats-Msg-Id',
    trust_provenance: true,
  } as BridgeAdapter['config']
  readonly into = new NullInto() as IntoWenyan<unknown>
  readonly from = new NullFrom() as FromWenyan<unknown>
  async start(_ctx: AdapterContext): Promise<void> {}
  async stop(): Promise<void> {}
  async health(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
  async publishOutbound(_document: MessageEnvelope): Promise<{ foreignId: string }> {
    throw new Error('simulated-publish-failure')
  }
}

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('bridge circuit breaker', () => {
  it('opens breaker after failures and marks subsequent queue items circuit-open', async () => {
    let dequeueCalls = 0
    const marks: Array<{ id: number; status: string; err?: string }> = []
    const archive = {
      getCurrentTiDefinition: async () => ({ messageId: 'ti-1', targetGenre: 'edict', version: '1.0.0', schema: {}, sealedAt: new Date().toISOString() }),
      enqueueBridgeOutbound: async () => {},
      dequeueBridgeOutbound: async () => {
        dequeueCalls += 1
        if (dequeueCalls === 1) return []
        return [
          { id: 1, adapterId: 'n1', messageId: 'm-1', attempts: 0, availableAt: new Date().toISOString(), status: 'queued' as const },
          { id: 2, adapterId: 'n1', messageId: 'm-2', attempts: 0, availableAt: new Date().toISOString(), status: 'queued' as const },
        ]
      },
      markBridgeOutboundResult: async (id: number, status: string, err?: string) => {
        marks.push({ id, status, err })
      },
    } as unknown as ArchiveRepository

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/stream')) {
        return new Response(JSON.stringify({ events: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.includes('/messages/m-1') || url.includes('/messages/m-2')) {
        return new Response(
          JSON.stringify({
            message: {
              id: url.endsWith('m-1') ? 'm-1' : 'm-2',
              genre: 'edict',
              payload: {},
              actor: { id: 'a', role: 'genesis_admin' },
              submittedAt: new Date().toISOString(),
              metadata: {},
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof globalThis.fetch

    const bootstrap = parseBootstrapConfig({
      archive: { engine: 'sqlite', path: './x.db' },
      genesis: { node_id: '00000000-0000-4000-8000-0000000000bb', genesis_key: 'x' },
      gateway: { listen: { host: '127.0.0.1', port: 8787 } },
      bridge: {
        enabled: true,
        sync: { mode: 'push', poll_interval_ms: 1000, batch_size: 10 },
        circuit_breaker: { failure_rate_threshold: 0.01, cool_down_ms: 60_000, max_retries: 2 },
        adapters: [
          {
            id: 'n1',
            protocol: 'nats',
            url: 'nats://127.0.0.1:4222',
            subject_pattern: ['events.*'],
            target_genre: 'edict',
            idempotency_header: 'Nats-Msg-Id',
            trust_provenance: true,
          },
        ],
      },
    })

    const bridge = new BridgeGateway({ bootstrap, archive, adapters: [new FailingAdapter()] })
    await bridge.start()
    await bridge.syncOnce()
    await bridge.stop()

    expect(marks.find((m) => m.id === 1)?.status).toBe('failed')
    expect(marks.find((m) => m.id === 2)?.err).toBe('circuit-open')
  })
})
