import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ArchiveRepository } from '@andrey-kokoev/wenyan-archive'
import { SqliteArchiveRepository } from '@andrey-kokoev/wenyan-archive/sqlite'
import { parseBootstrapConfigToml, type BootstrapConfig, type EdictLawType, type MessageEnvelope, type Transition } from '@andrey-kokoev/wenyan-core'
import { DEV_SEAL_CONTEXT, InsufficientImperialAuthorityError, createSealChain, verifySealChain, type SealContext } from '@andrey-kokoev/wenyan-seal'

function keyHexFromBase64 (base64: string): string {
  const raw = Buffer.from(base64, 'base64')
  if (raw.length !== 32) {
    throw new Error('genesis.genesis_key must decode to 32 bytes for ed25519 seed')
  }
  return raw.toString('hex')
}

function genesisSealContext (config: BootstrapConfig): SealContext {
  const keyHex = keyHexFromBase64(config.genesis.genesis_key)
  return {
    ...DEV_SEAL_CONTEXT,
    draftPrivateKeyHex: keyHex,
    masterPrivateKeyHex: keyHex,
    capabilitySecret: `genesis-${config.genesis.node_id}`,
    routeKey: `genesis.${config.genesis.node_id}`,
    lamportClock: 1,
    imperialSignatures: ['genesis'],
    thresholdPolicyOverrides: {
      minImperialSignaturesByGenre: {
        ti_definition: 1,
        edict: 1,
      },
    },
  }
}

function buildConfigText (config: BootstrapConfig): string {
  const preload = (config.law_cache?.preload_types ?? ['appointment', 'classification'])
    .map((x) => `"${x}"`)
    .join(', ')
  const ttl = config.law_cache?.ttl_seconds ?? 60
  const mode = config.law.mode
  const upstream = config.gateway.upstream ?? 'http://127.0.0.1:8787'

  return `[archive]
engine = "${config.archive.engine}"
path = "${config.archive.path}"

[genesis]
node_id = "${config.genesis.node_id}"
genesis_key = "${config.genesis.genesis_key}"

[gateway]
upstream = "${upstream}"

[gateway.listen]
host = "${config.gateway.listen.host}"
port = ${config.gateway.listen.port}

[auth]
jwt_issuer = "${config.auth.jwt_issuer}"
jwt_audience = "${config.auth.jwt_audience}"
jwt_alg = "${config.auth.jwt_alg}"
jwt_secret = "${config.auth.jwt_secret ?? ''}"
allow_header_actor = ${config.auth.allow_header_actor ? 'true' : 'false'}

[law]
mode = "${mode}"

[law_cache]
ttl_seconds = ${ttl}
preload_types = [${preload}]

[bridge]
enabled = ${config.bridge.enabled ? 'true' : 'false'}
mode = "${config.bridge.mode}"
`
}

function defaultConfig (): BootstrapConfig {
  return {
    archive: {
      engine: 'sqlite',
      path: "./wenyan.dang'an",
    },
    genesis: {
      node_id: randomUUID(),
      genesis_key: randomBytes(32).toString('base64'),
    },
    gateway: {
      upstream: 'http://127.0.0.1:8787',
      listen: {
        host: '127.0.0.1',
        port: 8787,
      },
      stream_mode: 'sse',
    },
    auth: {
      jwt_issuer: 'wenyan.local',
      jwt_audience: 'wenyan-gateway',
      jwt_alg: 'HS256',
      jwt_secret: randomBytes(32).toString('hex'),
      allow_header_actor: false,
    },
    law: {
      mode: 'strict',
    },
    law_cache: {
      ttl_seconds: 60,
      preload_types: ['appointment', 'classification'],
    },
    distributed: {
      mode: 'single',
      node_id: 'local-node',
      bind_gossip: '127.0.0.1:7946',
      seeds: [],
      fanout: 3,
      suspicion_timeout_ms: 5000,
    },
    consensus: {
      kind: 'none',
      replica_set: [],
      constitutional_threshold: 3,
      view_change_timeout_ms: 5000,
      allow_single_replica: false,
    },
    sync: {
      batch_size: 200,
      max_inflight: 4,
      retry_backoff_ms: 300,
    },
    bridge: {
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
    },
  }
}

function makeTiDefinition (targetGenre: string, schema: Record<string, unknown>, actorId: string): MessageEnvelope {
  return {
    id: `ti-${targetGenre}-${randomUUID()}`,
    genre: 'ti_definition',
    payload: {
      target_genre: targetGenre,
      version: '1.0.0',
      schema,
    },
    actor: { id: actorId, role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true, genesis: true },
  }
}

function makeEdict (
  lawType: EdictLawType,
  content: Record<string, unknown>,
  actorId: string,
): MessageEnvelope {
  return {
    id: `edict-${lawType}-${randomUUID()}`,
    genre: 'edict',
    payload: {
      law_type: lawType,
      version: '1.0.0',
      content,
      precedence: 0,
      effective_date: new Date().toISOString(),
    },
    actor: { id: actorId, role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true, genesis: true },
  }
}

async function appendArchived (repo: ArchiveRepository, message: MessageEnvelope, sealContext: SealContext): Promise<void> {
  await repo.appendMessage(message)
  const seals = await createSealChain(message, sealContext)
  const valid = await verifySealChain(message, seals, sealContext)
  if (!valid) throw new Error('invalid-seal-chain')
  for (const seal of seals) await repo.appendSeal(seal)

  const transition: Transition = {
    messageId: message.id,
    fromState: 'pending',
    toState: 'archived',
    sequenceNo: 1,
    actorId: message.actor.id,
    sealedAt: new Date().toISOString(),
    at: new Date().toISOString(),
    prevTransitionHash: 'GENESIS',
  }
  await repo.appendTransition(transition)
}

export async function applyGenesis (
  repo: ArchiveRepository,
  config: BootstrapConfig,
  sealContext = genesisSealContext(config),
): Promise<{ applied: number; skipped: number }> {
  const actorId = `genesis:${config.genesis.node_id}`
  let applied = 0
  let skipped = 0

  const tiTi = await repo.getCurrentTiDefinition('ti_definition')
  if (!tiTi) {
    await appendArchived(
      repo,
      makeTiDefinition('ti_definition', {
        type: 'object',
        required: ['target_genre', 'version', 'schema'],
      }, actorId),
      sealContext,
    )
    applied += 1
  } else {
    skipped += 1
  }

  const tiEdict = await repo.getCurrentTiDefinition('edict')
  if (!tiEdict) {
    await appendArchived(
      repo,
      makeTiDefinition('edict', {
        type: 'object',
        required: ['law_type', 'version', 'content', 'precedence', 'effective_date'],
      }, actorId),
      sealContext,
    )
    applied += 1
  } else {
    skipped += 1
  }

  const lawDefaults: Partial<Record<EdictLawType, Record<string, unknown>>> = {
    appointment: {
      roles: {
        genesis_admin: { permissions: ['draft', 'review', 'authorize'], allowed_genres: ['*'], max_pending: 1000 },
      },
    },
    classification: { levels: ['open', 'inner', 'secret', 'top'], hierarchy: 'strict', compartmentalization: true },
    routing: { table: {}, broadcast_policy: 'hierarchical' },
    admission: { allowed_genres: ['*'] },
    protocol: { required_acks_by_genre: {} },
    regulation: { retention_days: 3650, rate_limits: {} },
    access_control: {
      read_permissions: {
        genesis_admin: ['*'],
      },
      anonymous_read: true,
      query_hash_only: true,
    },
  }

  const nowIso = new Date().toISOString()
  const seededLawTypes: EdictLawType[] = ['appointment', 'classification', 'routing', 'admission', 'protocol', 'regulation', 'access_control']
  for (const lawType of seededLawTypes) {
    const existing = await repo.getCurrentLaw(lawType, nowIso)
    if (existing) {
      skipped += 1
      continue
    }
    await appendArchived(repo, makeEdict(lawType, lawDefaults[lawType] ?? {}, actorId), sealContext)
    applied += 1
  }

  return { applied, skipped }
}

export async function createEmptyOffice (dir: string, config: BootstrapConfig = defaultConfig()): Promise<{ configPath: string; dbPath: string }> {
  const officeDir = resolve(dir)
  await mkdir(officeDir, { recursive: true })

  const dbPath = resolve(officeDir, "wenyan.dang'an")
  const cfgPath = resolve(officeDir, 'wenyan.toml')

  await writeFile(cfgPath, buildConfigText(config), 'utf8')
  const parsed = parseBootstrapConfigToml(await readFile(cfgPath, 'utf8'))
  const repo = new SqliteArchiveRepository(dbPath)
  repo.initialize()
  repo.migrate()
  repo.close()
  return { configPath: cfgPath, dbPath }
}

export async function applyGenesisFromDir (dir = '.'): Promise<{ applied: number; skipped: number }> {
  const officeDir = resolve(dir)
  const cfgPath = resolve(officeDir, 'wenyan.toml')
  const dbPath = resolve(officeDir, "wenyan.dang'an")
  const parsed = parseBootstrapConfigToml(await readFile(cfgPath, 'utf8'))
  const repo = new SqliteArchiveRepository(dbPath)
  repo.initialize()
  repo.migrate()
  try {
    return await applyGenesis(repo, parsed)
  } catch (error) {
    if (error instanceof InsufficientImperialAuthorityError) {
      throw error
    }
    throw error
  } finally {
    repo.close()
  }
}
