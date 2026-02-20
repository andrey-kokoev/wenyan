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
})

const SyncConfigSchema = z.object({
  batch_size: z.number().int().positive().default(200),
  max_inflight: z.number().int().positive().default(4),
  retry_backoff_ms: z.number().int().positive().default(300),
})

export const BootstrapConfigSchema = z.object({
  archive: ArchiveConfigSchema,
  genesis: GenesisConfigSchema,
  gateway: GatewayConfigSchema,
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
  }),
  sync: SyncConfigSchema.default({
    batch_size: 200,
    max_inflight: 4,
    retry_backoff_ms: 300,
  }),
})

export type BootstrapConfig = z.infer<typeof BootstrapConfigSchema>

export function parseBootstrapConfigToml(text: string): BootstrapConfig {
  return BootstrapConfigSchema.parse(parseToml(text))
}

export function parseBootstrapConfig(input: unknown): BootstrapConfig {
  return BootstrapConfigSchema.parse(input)
}
