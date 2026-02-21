import { describe, expect, it } from 'vitest'
import { parseBootstrapConfig } from '@andrey-kokoev/wenyan-core'
import { BridgeGateway } from './gateway'
import { NatsIntoWenyanAdapter } from './adapters/nats'
import { resolveBridgeConflict } from './sync'

describe('bridge translation', () => {
  it('forgets non-mapped foreign metadata for nats payload', () => {
    const adapter = new NatsIntoWenyanAdapter({
      id: 'n1',
      protocol: 'nats',
      url: 'nats://localhost:4222',
      subject_pattern: ['tribute.*'],
      target_genre: 'tribute',
      idempotency_header: 'Nats-Msg-Id',
      trust_provenance: true,
    })
    const metadata = {
      protocol: 'nats' as const,
      adapterId: 'n1',
      subjectOrTopic: 'tribute.gold',
      headers: { 'Nats-Msg-Id': 'k-1', 'Nats-Time': 't' },
      timestampIso: new Date().toISOString(),
    }
    const translated = adapter.translate(
      {
        subject: 'tribute.gold',
        data: { amount: 100, type: 'gold' },
        headers: { 'Nats-Msg-Id': 'k-1', 'Barbarian-Chief': 'A' },
      },
      metadata,
    )
    expect(translated.ok).toBe(true)
    if (!translated.ok) return
    expect(translated.document.metadata?.['Barbarian-Chief']).toBeUndefined()
    expect(translated.document.metadata?.routing).toEqual({ destination: 'tribute/gold' })
  })
})

describe('bridge sync resolution', () => {
  it('prefers local imperial state over unverified foreign state', () => {
    const local = {
      id: 'm1',
      genre: 'treaty',
      payload: { value: 'local' },
      actor: { id: 'a', role: 'genesis_admin' },
      submittedAt: '2026-01-01T00:00:02.000Z',
      metadata: {},
    }
    const remote = {
      ...local,
      payload: { value: 'remote' },
      submittedAt: '2026-01-01T00:00:03.000Z',
    }
    const resolved = resolveBridgeConflict({
      local,
      remote,
      localClock: { wenyan: 1 },
      remoteClock: { foreign: 1 },
      localHasImperialSeal: true,
      remoteVerified: false,
    })
    expect(resolved.winner.payload.value).toBe('local')
  })
})

describe('bridge gateway', () => {
  it('supports dry-run and status without enabled runtime', async () => {
    const bootstrap = parseBootstrapConfig({
      archive: { engine: 'sqlite', path: "./wenyan.dang'an" },
      genesis: {
        node_id: '00000000-0000-4000-8000-000000000001',
        genesis_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      },
      gateway: { listen: { host: '127.0.0.1', port: 8787 } },
      bridge: {
        enabled: false,
        mode: 'standalone',
        adapters: [],
        sync: { mode: 'hybrid', poll_interval_ms: 1000, batch_size: 10 },
        circuit_breaker: { failure_rate_threshold: 0.05, cool_down_ms: 1000, max_retries: 2 },
      },
    })
    const gateway = new BridgeGateway({ bootstrap, adapters: [] })
    const status = await gateway.status()
    expect(status.running).toBe(false)
    expect(status.adapters).toEqual([])
  })
})
