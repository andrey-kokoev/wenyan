import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildGateway } from '../../gateway/src/index'
import { SqliteArchiveRepository } from '../../archive/src/sqlite'
import { ReliableChannel } from '../../channel/src/index'
import { DEV_SEAL_CONTEXT } from '../../seal/src/index'
import { createEmptyOffice, applyGenesisFromDir } from '../../genesis/src/index'
import { BridgeGateway } from '../../bridge/src/gateway'
import { resolveBridgeConflict } from '../../bridge/src/sync'
import type { AdapterContext, BridgeAdapter, ForeignMetadata, FromWenyan, IntoWenyan, TranslationResult } from '../../bridge/src/types'
import { parseBootstrapConfig } from '../../core/src/bootstrap'
import type { MessageEnvelope } from '../../core/src/index'
import type { NatsBridgeAdapterConfig } from '../../core/src/bootstrap'
import { waitForState } from './helpers'

const tempDirs = new Set<string>()

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  tempDirs.clear()
})

class FakeInto implements IntoWenyan<unknown> {
  constructor(private readonly genre: string) {}
  translate(payload: unknown, metadata: ForeignMetadata): TranslationResult {
    const data = payload as { body?: Record<string, unknown> }
    return {
      ok: true,
      document: {
        id: this.extractIdempotencyKey(payload, metadata),
        genre: this.genre,
        payload: data.body ?? {},
        actor: { id: 'bridge', role: 'genesis_admin' },
        submittedAt: metadata.timestampIso,
        metadata: {
          idempotency_key: this.extractIdempotencyKey(payload, metadata),
          routing: { destination: 'imperial/treasury' },
          provenance: { foreign: metadata.protocol, trusted: true },
          // must be dropped by bridge sanitization:
          foreign_headers: metadata.headers,
        },
      },
    }
  }
  extractIdempotencyKey(_payload: unknown, metadata: ForeignMetadata): string {
    return metadata.headers['Foreign-Id'] ?? `f-${Date.now()}`
  }
  async verifyProvenance(): Promise<boolean> {
    return true
  }
}

class FakeFrom implements FromWenyan<Record<string, unknown>> {
  translate(document: MessageEnvelope): Record<string, unknown> {
    return { payload: document.payload, seal6: document.id }
  }
  reconcile(local: Record<string, unknown>): Record<string, unknown> {
    return local
  }
}

class FakeBridgeAdapter implements BridgeAdapter {
  readonly protocol = 'nats' as const
  readonly into: IntoWenyan<unknown>
  readonly from: FromWenyan<unknown>
  readonly config: NatsBridgeAdapterConfig
  readonly id: string
  private ctx: AdapterContext | undefined
  published: Array<{ id: string }> = []
  constructor(id: string, targetGenre: string) {
    this.id = id
    this.config = {
      id,
      protocol: 'nats' as const,
      url: 'nats://test',
      subject_pattern: ['tribute.*'],
      target_genre: targetGenre,
      idempotency_header: 'Foreign-Id',
      trust_provenance: true,
    }
    this.into = new FakeInto(targetGenre)
    this.from = new FakeFrom() as FromWenyan<unknown>
  }
  async start(ctx: AdapterContext): Promise<void> {
    this.ctx = ctx
  }
  async stop(): Promise<void> {}
  async health(): Promise<{ ok: boolean }> {
    return { ok: true }
  }
  async publishOutbound(document: MessageEnvelope): Promise<{ foreignId: string }> {
    this.published.push({ id: document.id })
    return { foreignId: `${this.id}:${document.id}` }
  }
  async ingest(payload: unknown, metadata: ForeignMetadata): Promise<void> {
    if (!this.ctx) throw new Error('adapter not started')
    await this.ctx.onInbound(this, payload, metadata)
  }
}

async function setupOffice(name: string): Promise<{ repo: SqliteArchiveRepository; app: ReturnType<typeof buildGateway>; dir: string }> {
  const dir = mkdtempSync(join(tmpdir(), `wenyan-ritual-v050-${name}-`))
  tempDirs.add(dir)
  await createEmptyOffice(dir)
  await applyGenesisFromDir(dir)
  const repo = new SqliteArchiveRepository(resolve(dir, "wenyan.dang'an"))
  repo.initialize()
  repo.migrate()
  const seedId = `ac-bridge-${Date.now()}`
  repo.appendMessage({
    id: seedId,
    genre: 'edict',
    payload: {
      law_type: 'access_control',
      version: '1.0.0',
      content: {
        anonymous_read: true,
        read_permissions: { genesis_admin: ['*'] },
        query_hash_only: true,
      },
      precedence: 0,
      effective_date: new Date().toISOString(),
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true },
  })
  repo.appendTransition({
    messageId: seedId,
    fromState: 'pending',
    toState: 'archived',
    sequenceNo: 1,
    actorId: 'seed',
    sealedAt: new Date().toISOString(),
    at: new Date().toISOString(),
    prevTransitionHash: 'GENESIS',
  })
  const app = buildGateway(repo, new ReliableChannel(), { ...DEV_SEAL_CONTEXT, imperialSignatures: ['a', 'b', 'c'] }, { lawMode: 'strict' })
  return { repo, app, dir }
}

function withGatewayFetch(app: ReturnType<typeof buildGateway>, base = 'http://bridge.local') {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input.toString()
    if (raw.startsWith(base)) {
      const url = new URL(raw)
      const path = url.pathname.replace('/api/wenyan', '') + (url.search || '')
      return app.request(path, init)
    }
    if (!original) throw new Error('fetch is unavailable in test runtime')
    return original(input, init)
  }) as typeof globalThis.fetch
  return () => {
    globalThis.fetch = original
  }
}

describe('Wenyan v0.5.0 bridge rituals', () => {
  it('ingests foreign payload through forgetting boundary and archives with six seals', async () => {
    const { repo, app } = await setupOffice('barbarian')
    const restore = withGatewayFetch(app)
    const adapter = new FakeBridgeAdapter('nats-main', 'edict')
    const bootstrap = parseBootstrapConfig({
      archive: { engine: 'sqlite', path: "./wenyan.dang'an" },
      genesis: { node_id: '00000000-0000-4000-8000-000000000010', genesis_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
      gateway: { listen: { host: '127.0.0.1', port: 8787 }, stream_mode: 'sse' },
      bridge: {
        enabled: true,
        adapters: [adapter.config],
      },
    })
    const bridge = new BridgeGateway({ bootstrap, archive: repo, apiBaseUrl: 'http://bridge.local/api/wenyan', adapters: [adapter] })
    await bridge.start()
    await adapter.ingest(
      { body: { law_type: 'regulation', version: '1.0.0', content: { tax: 0.1 }, precedence: 0, effective_date: new Date().toISOString() } },
      {
        protocol: 'nats',
        adapterId: 'nats-main',
        subjectOrTopic: 'tribute.gold',
        headers: {
          'Foreign-Id': 'seq-42',
          'Nats-Sequence': '42',
          'Barbarian-Chief': 'Attila',
          'Nats-Time': '2026-05-01T00:00:00.000Z',
          'X-1': 'aaaaaaaaaa',
          'X-2': 'bbbbbbbbbb',
          'X-3': 'cccccccccc',
          'X-4': 'dddddddddd',
          'X-5': 'eeeeeeeeee',
          'X-6': 'ffffffffff',
          'X-7': 'gggggggggg',
          'X-8': 'hhhhhhhhhh',
          'X-9': 'iiiiiiiiii',
          'X-10': 'jjjjjjjjjj',
        },
        timestampIso: new Date().toISOString(),
      },
    )

    const json = await waitForState(app, 'seq-42', 'archived') as unknown as { message: MessageEnvelope; seals: unknown[] }
    expect(json.seals).toHaveLength(6)
    expect((json.message.metadata as Record<string, unknown>).foreign_headers).toBeUndefined()

    const status = await bridge.status()
    expect(status.metrics.bridge_information_loss_ratio).toBeGreaterThan(0)
    await bridge.stop()
    restore()
    repo.close()
  })

  it('fails closed when adapter target genre has no active ti_definition', async () => {
    const { repo, app } = await setupOffice('fail-closed')
    const restore = withGatewayFetch(app)
    const adapter = new FakeBridgeAdapter('nats-main', 'undefined_genre')
    const bootstrap = parseBootstrapConfig({
      archive: { engine: 'sqlite', path: "./wenyan.dang'an" },
      genesis: { node_id: '00000000-0000-4000-8000-000000000011', genesis_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
      gateway: { listen: { host: '127.0.0.1', port: 8787 }, stream_mode: 'sse' },
      bridge: { enabled: true, adapters: [adapter.config] },
    })
    const bridge = new BridgeGateway({ bootstrap, archive: repo, apiBaseUrl: 'http://bridge.local/api/wenyan', adapters: [adapter] })
    await expect(bridge.start()).rejects.toThrow('bridge target genre undefined')
    restore()
    repo.close()
  })

  it('queues outbound sync and updates foreign sync state on publish', async () => {
    const { repo, app } = await setupOffice('outbound')
    const restore = withGatewayFetch(app)
    const adapter = new FakeBridgeAdapter('nats-main', 'edict')
    const bootstrap = parseBootstrapConfig({
      archive: { engine: 'sqlite', path: "./wenyan.dang'an" },
      genesis: { node_id: '00000000-0000-4000-8000-000000000012', genesis_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
      gateway: { listen: { host: '127.0.0.1', port: 8787 }, stream_mode: 'sse' },
      bridge: { enabled: true, adapters: [adapter.config] },
    })
    const bridge = new BridgeGateway({ bootstrap, archive: repo, apiBaseUrl: 'http://bridge.local/api/wenyan', adapters: [adapter] })
    await bridge.start()

    const submitRes = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'edict-outbound-1',
        genre: 'edict',
        payload: { law_type: 'regulation', version: '1.0.0', content: { tax: 0.2 }, precedence: 0, effective_date: new Date().toISOString() },
        actor: { id: 'a', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: { routing: { foreign_system: 'nats' } },
      }),
    })
    expect(submitRes.status).toBe(202)
    await waitForState(app, 'edict-outbound-1', 'archived')

    const sync = await bridge.syncOnce('nats-main')
    expect(sync.pushed).toBeGreaterThanOrEqual(1)
    expect(adapter.published.length).toBeGreaterThan(0)
    const state = repo.getForeignSyncState('edict-outbound-1')
    expect(state?.adapterId).toBe('nats-main')

    await bridge.stop()
    restore()
    repo.close()
  })

  it('resolves concurrent updates deterministically and produces merged vector clock', () => {
    const local: MessageEnvelope = {
      id: 'treaty-1',
      genre: 'edict',
      payload: { destination: 'new_cabinet' },
      actor: { id: 'a', role: 'genesis_admin' },
      submittedAt: '2026-05-01T00:00:02.000Z',
      metadata: {},
    }
    const remote: MessageEnvelope = {
      ...local,
      payload: { destination: 'old_cabinet' },
      submittedAt: '2026-05-01T00:00:01.000Z',
    }
    const resolved = resolveBridgeConflict({
      local,
      remote,
      localClock: { wenyan: 1, foreign: 0 },
      remoteClock: { wenyan: 0, foreign: 1 },
      localHasImperialSeal: true,
      remoteVerified: false,
      strategy: 'lww',
    })
    expect(resolved.status).toBe('resolved')
    expect(resolved.winner.payload.destination).toBe('new_cabinet')
    expect(resolved.mergedClock).toEqual({ wenyan: 0, foreign: 1 })
  })
})
