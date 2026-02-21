import { describe, expect, it } from 'vitest'
import {
  BootstrapConfigSchema,
  CensorateRuntimeConfigSchema,
  EdictSchema,
  canTransition,
  parseBootstrapConfigToml,
  validateEnvelope,
} from './index'

describe('core', () => {
  it('validates envelope', () => {
    const msg = validateEnvelope({
      id: 'm1',
      genre: 'memo',
      payload: { a: 1 },
      actor: { id: 'u1', role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })
    expect(msg.id).toBe('m1')
  })

  it('enforces transitions', () => {
    expect(canTransition('pending', 'validated')).toBe(true)
    expect(canTransition('pending', 'archived')).toBe(false)
  })

  it('validates edict documents', () => {
    const edict = EdictSchema.parse({
      id: 'e1',
      genre: 'edict',
      payload: {
        law_type: 'admission',
        version: '1.0.0',
        content: { allowed_genres: ['petition'] },
        precedence: 0,
        effective_date: new Date().toISOString(),
      },
      actor: { id: 'u1', role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })

    expect(edict.payload.law_type).toBe('admission')
  })

  it('accepts extended law types for censorate', () => {
    const edict = EdictSchema.parse({
      id: 'e2',
      genre: 'edict',
      payload: {
        law_type: 'access_control',
        version: '1.0.0',
        content: { read_permissions: { clerk: ['tax_record'] } },
        precedence: 0,
        effective_date: new Date().toISOString(),
      },
      actor: { id: 'u1', role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })
    expect(edict.payload.law_type).toBe('access_control')
    expect(CensorateRuntimeConfigSchema.parse({ enabled: true }).enabled).toBe(true)
  })

  it('parses bootstrap toml', () => {
    const cfg = parseBootstrapConfigToml(`
[archive]
engine = "sqlite"
path = "./wenyan.dang'an"

[genesis]
node_id = "11111111-1111-4111-8111-111111111111"
genesis_key = "Zm9v"

[gateway.listen]
host = "127.0.0.1"
port = 8787

[law]
mode = "strict"
`)
    expect(BootstrapConfigSchema.parse(cfg).archive.engine).toBe('sqlite')
    expect(cfg.gateway.listen.port).toBe(8787)
  })

  it('rejects duplicate bridge adapter ids', () => {
    expect(() =>
      BootstrapConfigSchema.parse({
        archive: { engine: 'sqlite', path: "./wenyan.dang'an" },
        genesis: {
          node_id: '11111111-1111-4111-8111-111111111111',
          genesis_key: 'Zm9v',
        },
        gateway: { listen: { host: '127.0.0.1', port: 8787 } },
        bridge: {
          enabled: true,
          adapters: [
            {
              id: 'n1',
              protocol: 'nats',
              url: 'nats://localhost:4222',
              subject_pattern: ['events.*'],
              target_genre: 'telemetry',
              idempotency_header: 'Nats-Msg-Id',
              trust_provenance: false,
            },
            {
              id: 'n1',
              protocol: 'nats',
              url: 'nats://localhost:4222',
              subject_pattern: ['events.*'],
              target_genre: 'telemetry',
              idempotency_header: 'Nats-Msg-Id',
              trust_provenance: false,
            },
          ],
        },
      }),
    ).toThrow(/duplicate bridge adapter id/)
  })

  it('rejects consort pbft threshold < 2 by default', () => {
    expect(() =>
      BootstrapConfigSchema.parse({
        archive: { engine: 'sqlite', path: "./wenyan.dang'an" },
        genesis: {
          node_id: '11111111-1111-4111-8111-111111111111',
          genesis_key: 'Zm9v',
        },
        gateway: { listen: { host: '127.0.0.1', port: 8787 } },
        distributed: {
          mode: 'consort',
          node_id: 'node-1',
          bind_gossip: '127.0.0.1:7946',
          seeds: [],
          fanout: 3,
          suspicion_timeout_ms: 5000,
        },
        consensus: {
          kind: 'pbft',
          replica_set: ['node-1', 'node-2', 'node-3'],
          constitutional_threshold: 1,
          view_change_timeout_ms: 5000,
          allow_single_replica: false,
        },
      }),
    ).toThrow(/threshold >= 2/)
  })
})
