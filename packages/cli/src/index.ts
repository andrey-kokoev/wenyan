#!/usr/bin/env node
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { SqliteArchiveRepository } from '@wenyan/archive/sqlite'
import { parseBootstrapConfigToml, type BootstrapConfig, type EdictLawType } from '@wenyan/core'
import { processDocketMessage } from '@wenyan/pipeline'
import { DEV_SEAL_CONTEXT, type SealContext } from '@wenyan/seal'

const baseUrl = process.env.WENYAN_API_URL ?? 'http://127.0.0.1:8787/api/wenyan'

async function postMessage(input: string) {
  const body = JSON.parse(input)
  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function status(id: string) {
  const res = await fetch(`${baseUrl}/messages/${id}`)
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function query(state: string) {
  const res = await fetch(`${baseUrl}/messages?state=${encodeURIComponent(state)}`)
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function stream() {
  const res = await fetch(`${baseUrl}/stream`)
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

function argValue(flag: string, args: string[]): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`))
  if (eq) return eq.slice(flag.length + 1)
  const idx = args.indexOf(flag)
  if (idx < 0) return undefined
  return args[idx + 1]
}

async function draft(args: string[]): Promise<void> {
  const genre = argValue('--genre', args) ?? 'petition'
  const template = argValue('--template', args) ?? 'formal'
  const outPath = args[args.length - 1]
  if (!outPath || outPath.startsWith('--')) {
    throw new Error('draft requires an output file path')
  }

  const doc = {
    id: `draft-${randomUUID()}`,
    genre,
    payload: {
      template,
      title: '',
      body: '',
      routing: {
        destination: 'capital/secretariat',
      },
    },
    actor: {
      id: process.env.WENYAN_ACTOR_ID ?? 'local-scribe',
      role: 'admin',
    },
    submittedAt: new Date().toISOString(),
    metadata: {
      draft: true,
      officeSealPending: true,
    },
  }

  await writeFile(outPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  console.log(`draft created: ${outPath}`)
}

function buildConfigText(config: BootstrapConfig): string {
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

[law]
mode = "${mode}"

[law_cache]
ttl_seconds = ${ttl}
preload_types = [${preload}]
`
}

function keyHexFromBase64(base64: string): string {
  const raw = Buffer.from(base64, 'base64')
  if (raw.length !== 32) {
    throw new Error('genesis.genesis_key must decode to 32 bytes for ed25519 seed')
  }
  return raw.toString('hex')
}

function genesisSealContext(config: BootstrapConfig): SealContext {
  const keyHex = keyHexFromBase64(config.genesis.genesis_key)
  return {
    ...DEV_SEAL_CONTEXT,
    draftPrivateKeyHex: keyHex,
    masterPrivateKeyHex: keyHex,
    capabilitySecret: `genesis-${config.genesis.node_id}`,
    routeKey: `genesis.${config.genesis.node_id}`,
    lamportClock: 1,
  }
}

async function seedMessage(repo: SqliteArchiveRepository, message: Record<string, unknown>, sealContext: SealContext): Promise<void> {
  const envelope = message as Parameters<typeof repo.appendMessage>[0]
  repo.appendMessage(envelope)
  repo.enqueueDocket(envelope.id)
  const item = repo.dequeueDocket(new Date().toISOString())
  if (!item) throw new Error(`failed to dequeue seeded message ${envelope.id}`)
  await processDocketMessage(repo, item.messageId, sealContext, { lawMode: 'compat' })
}

function makeTiDefinition(targetGenre: string, schema: Record<string, unknown>, actorId: string, supersededBy?: string) {
  return {
    id: `ti-${targetGenre}-${randomUUID()}`,
    genre: 'ti_definition',
    payload: {
      target_genre: targetGenre,
      version: '1.0.0',
      schema,
      ...(supersededBy ? { superseded_by: supersededBy } : {}),
    },
    actor: { id: actorId, role: 'admin' },
    submittedAt: new Date().toISOString(),
    metadata: { genesis: true },
  }
}

function makeEdict(
  lawType: EdictLawType,
  content: Record<string, unknown>,
  actorId: string,
): Record<string, unknown> {
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
    actor: { id: actorId, role: 'admin' },
    submittedAt: new Date().toISOString(),
    metadata: { genesis: true },
  }
}

async function seedGenesisLaw(repo: SqliteArchiveRepository, config: BootstrapConfig): Promise<void> {
  const actorId = `genesis:${config.genesis.node_id}`
  const sealContext = genesisSealContext(config)

  if (!repo.getActiveGenreSchema('ti_definition')) {
    await seedMessage(
      repo,
      makeTiDefinition('ti_definition', {
        type: 'object',
        required: ['target_genre', 'version', 'schema'],
        properties: {
          target_genre: { type: 'string' },
          version: { type: 'string' },
          schema: { type: 'object' },
          superseded_by: { type: 'string' },
        },
      }, actorId),
      sealContext,
    )
  }

  if (!repo.getActiveGenreSchema('edict')) {
    await seedMessage(
      repo,
      makeTiDefinition('edict', {
        type: 'object',
        required: ['law_type', 'version', 'content', 'precedence', 'effective_date'],
        properties: {
          law_type: { type: 'string' },
          version: { type: 'string' },
          content: { type: 'object' },
          precedence: { type: 'number' },
          effective_date: { type: 'string' },
          superseded_edict_id: { type: 'string' },
        },
      }, actorId),
      sealContext,
    )
  }

  const lawDefaults: Record<EdictLawType, Record<string, unknown>> = {
    appointment: {
      roles: {
        admin: { permissions: ['draft', 'review', 'authorize'], allowed_genres: ['*'], max_pending: 1000 },
        scribe: { permissions: ['draft'], allowed_genres: ['*'], max_pending: 100 },
        reviewer: { permissions: ['review'], allowed_genres: ['*'], max_pending: 100 },
        approver: { permissions: ['review', 'authorize'], allowed_genres: ['*'], max_pending: 100 },
        archivist: { permissions: ['query_archive'], allowed_genres: ['*'], max_pending: 1000 },
      },
    },
    classification: {
      levels: ['open', 'inner', 'secret', 'top'],
      hierarchy: 'strict',
      compartmentalization: true,
    },
    routing: {
      table: {},
      broadcast_policy: 'hierarchical',
    },
    admission: {
      allowed_genres: ['*'],
    },
    protocol: {
      required_acks_by_genre: {},
    },
    regulation: {
      retention_days: 3650,
      rate_limits: {},
    },
  }

  const nowIso = new Date().toISOString()
  for (const lawType of Object.keys(lawDefaults) as EdictLawType[]) {
    const existing = repo.getCurrentLaw(lawType, nowIso)
    if (existing) continue
    await seedMessage(repo, makeEdict(lawType, lawDefaults[lawType], actorId), sealContext)
  }
}

async function initOffice(pathArg?: string): Promise<void> {
  const officeDir = resolve(pathArg ?? '.')
  await mkdir(officeDir, { recursive: true })

  const dbPath = resolve(officeDir, "wenyan.dang'an")
  const cfgPath = resolve(officeDir, 'wenyan.toml')

  const config: BootstrapConfig = {
    archive: {
      engine: 'sqlite',
      path: './wenyan.dang\'an',
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
    },
    law: {
      mode: 'compat',
    },
    law_cache: {
      ttl_seconds: 60,
      preload_types: ['appointment', 'classification'],
    },
  }

  await writeFile(cfgPath, buildConfigText(config), 'utf8')
  const parsed = parseBootstrapConfigToml(await readFile(cfgPath, 'utf8'))

  const repo = new SqliteArchiveRepository(dbPath)
  repo.initialize()
  repo.migrate()
  await seedGenesisLaw(repo, parsed)
  repo.close()

  console.log(`initialized office at ${officeDir}`)
}

async function joinPeer(peer?: string): Promise<void> {
  if (!peer) {
    throw new Error('--join requires a peer URL, e.g. tcp://peer:8080')
  }

  const marker = resolve('.wenyan-join')
  await writeFile(marker, `${peer}\n`, 'utf8')
  console.log(`joined peer: ${peer}`)
}

async function submit(arg?: string): Promise<void> {
  if (arg) {
    await postMessage(await readFile(arg, 'utf8'))
    return
  }

  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  await postMessage(Buffer.concat(chunks).toString('utf8'))
}

async function main() {
  const args = process.argv.slice(2)
  const [cmd, arg] = args

  if (cmd === '--init') {
    await initOffice(arg)
    return
  }

  if (cmd === '--join') {
    await joinPeer(arg)
    return
  }

  if (cmd === 'draft') {
    await draft(args.slice(1))
    return
  }

  if (cmd === 'submit') {
    await submit(arg)
    return
  }

  if (cmd === 'status' && arg) {
    await status(arg)
    return
  }

  if (cmd === 'query') {
    const state = argValue('--state', args) ?? arg
    if (!state || state.startsWith('--')) {
      throw new Error('query requires a state (e.g. query --state archived)')
    }
    await query(state)
    return
  }

  if (cmd === 'stream') {
    await stream()
    return
  }

  if (!cmd && existsSync('wenyan.toml')) {
    console.log('wenyan office detected. use: draft | submit | status | query | stream')
    return
  }

  console.error(
    'Usage: wenyan --init <dir> | --join <peer> | draft --genre=<g> --template=<t> <file> | submit <file|stdin> | status <id> | query --state <state> | stream',
  )
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
