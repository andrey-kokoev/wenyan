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

export const BootstrapConfigSchema = z.object({
  archive: ArchiveConfigSchema,
  genesis: GenesisConfigSchema,
  gateway: GatewayConfigSchema,
  law: LawConfigSchema.default({ mode: 'strict' }),
  law_cache: LawCacheConfigSchema.optional(),
})

export type BootstrapConfig = z.infer<typeof BootstrapConfigSchema>

export function parseBootstrapConfigToml(text: string): BootstrapConfig {
  return BootstrapConfigSchema.parse(parseToml(text))
}

export function parseBootstrapConfig(input: unknown): BootstrapConfig {
  return BootstrapConfigSchema.parse(input)
}
