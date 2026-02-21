import { z } from 'zod'
import { parse as parseToml } from 'smol-toml'
import { EdictLawTypeSchema, LawModeSchema } from './law'

const ArchiveConfigSchema = z.object({
  engine: z.enum(['sqlite', 'cloudflare']),
  path: z.string().min(1),
})

const GenesisConfigSchema = z.object({
  node_id: z.string().uuid(),
  genesis_key: z.string().min(1),
})

const GatewayListenSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
})

const GatewayConfigSchema = z.object({
  listen: GatewayListenSchema,
  upstream: z.string().url().optional(),
  stream_mode: z.enum(['sse']).default('sse'),
})

const LawConfigSchema = z.object({
  mode: LawModeSchema.default('strict'),
})

const LawCacheConfigSchema = z.object({
  ttl_seconds: z.number().int().positive().default(60),
  preload_types: z.array(EdictLawTypeSchema).default(['appointment', 'classification']),
})

export const DistributedModeSchema = z.enum(['single', 'consort'])
export const ConsensusKindSchema = z.enum(['none', 'pbft'])

const DistributedConfigSchema = z.object({
  mode: DistributedModeSchema.default('single'),
  node_id: z.string().min(1).default('local-node'),
  bind_gossip: z.string().min(1).default('127.0.0.1:7946'),
  seeds: z.array(z.string().min(1)).default([]),
  fanout: z.number().int().positive().default(3),
  suspicion_timeout_ms: z.number().int().positive().default(5000),
})

const ConsensusConfigSchema = z.object({
  kind: ConsensusKindSchema.default('none'),
  replica_set: z.array(z.string().min(1)).default([]),
  constitutional_threshold: z.number().int().positive().default(3),
  view_change_timeout_ms: z.number().int().positive().default(5000),
  allow_single_replica: z.boolean().default(false),
})

const AuthConfigSchema = z
  .object({
    jwt_issuer: z.string().min(1).default('wenyan.local'),
    jwt_audience: z.string().min(1).default('wenyan-gateway'),
    jwt_alg: z.enum(['HS256', 'EdDSA']).default('HS256'),
    jwt_secret: z.string().min(1).optional(),
    jwt_public_keys: z.record(z.string(), z.string().min(1)).optional(),
    allow_header_actor: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.jwt_alg === 'HS256' && !val.jwt_secret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jwt_secret'],
        message: 'jwt_secret is required when jwt_alg=HS256',
      })
    }
    if (val.jwt_alg === 'EdDSA' && (!val.jwt_public_keys || Object.keys(val.jwt_public_keys).length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jwt_public_keys'],
        message: 'jwt_public_keys is required when jwt_alg=EdDSA',
      })
    }
  })

const SyncConfigSchema = z.object({
  batch_size: z.number().int().positive().default(200),
  max_inflight: z.number().int().positive().default(4),
  retry_backoff_ms: z.number().int().positive().default(300),
})

export const BridgeModeSchema = z.enum(['embedded', 'standalone'])
export const BridgeProtocolSchema = z.enum(['nats', 'kafka', 'mqtt', 'erp', 'payroll', 'regulatory'])
export const BridgeSyncModeSchema = z.enum(['poll', 'push', 'hybrid'])
export const BridgeMetadataModeSchema = z.enum(['strict', 'compat'])

const BaseBridgeAdapterConfigSchema = z.object({
  id: z.string().min(1),
  protocol: BridgeProtocolSchema,
  target_genre: z.string().min(1),
  trust_provenance: z.boolean().default(false),
  metadata_mode: BridgeMetadataModeSchema.default('strict'),
})

const NatsBridgeAdapterConfigSchema = BaseBridgeAdapterConfigSchema.extend({
  protocol: z.literal('nats'),
  url: z.string().min(1),
  subject_pattern: z.array(z.string().min(1)).min(1),
  idempotency_header: z.string().min(1).default('Nats-Msg-Id'),
})

const KafkaBridgeAdapterConfigSchema = BaseBridgeAdapterConfigSchema.extend({
  protocol: z.literal('kafka'),
  brokers: z.array(z.string().min(1)).min(1),
  topics: z.array(z.string().min(1)).min(1),
  consumer_group: z.string().min(1),
})

const MqttBridgeAdapterConfigSchema = BaseBridgeAdapterConfigSchema.extend({
  protocol: z.literal('mqtt'),
  url: z.string().min(1),
  topics: z.array(z.string().min(1)).min(1),
  qos: z.number().int().min(0).max(2).default(1),
})

const ErpBridgeAdapterConfigSchema = BaseBridgeAdapterConfigSchema.extend({
  protocol: z.literal('erp'),
  endpoint: z.string().url(),
  path: z.string().min(1).default('/purchase-orders'),
})

const PayrollBridgeAdapterConfigSchema = BaseBridgeAdapterConfigSchema.extend({
  protocol: z.literal('payroll'),
  endpoint: z.string().url(),
  webhook_path: z.string().min(1).default('/webhooks/payroll'),
})

const RegulatoryBridgeAdapterConfigSchema = BaseBridgeAdapterConfigSchema.extend({
  protocol: z.literal('regulatory'),
  url: z.string().min(1),
  topic: z.string().min(1).default('regulatory/safety'),
})

export const BridgeAdapterConfigSchema = z.discriminatedUnion('protocol', [
  NatsBridgeAdapterConfigSchema,
  KafkaBridgeAdapterConfigSchema,
  MqttBridgeAdapterConfigSchema,
  ErpBridgeAdapterConfigSchema,
  PayrollBridgeAdapterConfigSchema,
  RegulatoryBridgeAdapterConfigSchema,
])

const BridgeSyncConfigSchema = z.object({
  mode: BridgeSyncModeSchema.default('hybrid'),
  poll_interval_ms: z.number().int().positive().default(1000),
  batch_size: z.number().int().positive().default(100),
})

const BridgeCircuitBreakerSchema = z.object({
  failure_rate_threshold: z.number().positive().max(1).default(0.05),
  cool_down_ms: z.number().int().positive().default(30_000),
  max_retries: z.number().int().nonnegative().default(10),
})

const BridgeConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    mode: BridgeModeSchema.default('standalone'),
    adapters: z.array(BridgeAdapterConfigSchema).default([]),
    sync: BridgeSyncConfigSchema.default({
      mode: 'hybrid',
      poll_interval_ms: 1000,
      batch_size: 100,
    }),
    circuit_breaker: BridgeCircuitBreakerSchema.default({
      failure_rate_threshold: 0.05,
      cool_down_ms: 30_000,
      max_retries: 10,
    }),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>()
    for (const adapter of val.adapters) {
      if (seen.has(adapter.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['adapters'],
          message: `duplicate bridge adapter id: ${adapter.id}`,
        })
      }
      seen.add(adapter.id)
    }
  })

export const BootstrapConfigSchema = z.object({
  archive: ArchiveConfigSchema,
  genesis: GenesisConfigSchema,
  gateway: GatewayConfigSchema,
  auth: AuthConfigSchema.default({
    jwt_issuer: 'wenyan.local',
    jwt_audience: 'wenyan-gateway',
    jwt_alg: 'HS256',
    jwt_secret: 'wenyan-local-jwt-secret',
    allow_header_actor: false,
  }),
  law: LawConfigSchema.default({ mode: 'strict' }),
  law_cache: LawCacheConfigSchema.optional(),
  distributed: DistributedConfigSchema.default({
    mode: 'single',
    node_id: 'local-node',
    bind_gossip: '127.0.0.1:7946',
    seeds: [],
    fanout: 3,
    suspicion_timeout_ms: 5000,
  }),
  consensus: ConsensusConfigSchema.default({
    kind: 'none',
    replica_set: [],
    constitutional_threshold: 3,
    view_change_timeout_ms: 5000,
    allow_single_replica: false,
  }),
  sync: SyncConfigSchema.default({
    batch_size: 200,
    max_inflight: 4,
    retry_backoff_ms: 300,
  }),
  bridge: BridgeConfigSchema.default({
    enabled: false,
    mode: 'standalone',
    adapters: [],
    sync: {
      mode: 'hybrid',
      poll_interval_ms: 1000,
      batch_size: 100,
    },
    circuit_breaker: {
      failure_rate_threshold: 0.05,
      cool_down_ms: 30_000,
      max_retries: 10,
    },
  }),
}).superRefine((val, ctx) => {
  if (
    val.distributed.mode === 'consort' &&
    val.consensus.kind === 'pbft' &&
    val.consensus.constitutional_threshold < 2 &&
    !val.consensus.allow_single_replica
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['consensus', 'constitutional_threshold'],
      message: 'consort PBFT requires threshold >= 2 unless allow_single_replica=true',
    })
  }
})

export type BootstrapConfig = z.infer<typeof BootstrapConfigSchema>
export type BridgeMode = z.infer<typeof BridgeModeSchema>
export type BridgeProtocol = z.infer<typeof BridgeProtocolSchema>
export type BridgeMetadataMode = z.infer<typeof BridgeMetadataModeSchema>
export type BridgeAdapterConfig = z.input<typeof BridgeAdapterConfigSchema>
export type NatsBridgeAdapterConfig = z.input<typeof NatsBridgeAdapterConfigSchema>
export type KafkaBridgeAdapterConfig = z.input<typeof KafkaBridgeAdapterConfigSchema>
export type MqttBridgeAdapterConfig = z.input<typeof MqttBridgeAdapterConfigSchema>
export type ErpBridgeAdapterConfig = z.input<typeof ErpBridgeAdapterConfigSchema>
export type PayrollBridgeAdapterConfig = z.input<typeof PayrollBridgeAdapterConfigSchema>
export type RegulatoryBridgeAdapterConfig = z.input<typeof RegulatoryBridgeAdapterConfigSchema>

export function parseBootstrapConfigToml(text: string): BootstrapConfig {
  return BootstrapConfigSchema.parse(parseToml(text))
}

export function parseBootstrapConfig(input: unknown): BootstrapConfig {
  return BootstrapConfigSchema.parse(input)
}
