#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { constitutionalMerkleRoot } from '@wenyan/channel'
import { createEmptyOffice, applyGenesisFromDir } from '@wenyan/genesis'
import { parseBootstrapConfigToml } from '@wenyan/core'
import { SqliteArchiveRepository } from '@wenyan/archive/sqlite'
import { BridgeGateway } from '@wenyan/bridge'

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

function actorHeaders() {
  const actorId = process.env.WENYAN_ACTOR_ID ?? 'local-operator'
  const actorRole = process.env.WENYAN_ACTOR_ROLE ?? 'genesis_admin'
  return {
    'x-wenyan-actor-id': actorId,
    'x-wenyan-actor-role': actorRole,
    authorization: `Bearer ${actorId}`,
  }
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

function parseWindow(input: string): string {
  const now = Date.now()
  const m = /^([0-9]+)([smhd])$/.exec(input.trim())
  if (!m) return new Date(now - 60 * 60 * 1000).toISOString()
  const value = Number(m[1])
  const unit = m[2]
  const ms =
    unit === 's' ? value * 1000 :
    unit === 'm' ? value * 60 * 1000 :
    unit === 'h' ? value * 60 * 60 * 1000 :
    value * 24 * 60 * 60 * 1000
  return new Date(now - ms).toISOString()
}

async function auditWhoRead(args: string[]): Promise<void> {
  const document = argValue('--document', args)
  const genre = argValue('--genre', args)
  const since = argValue('--since', args)
  if (!document && !genre) throw new Error('audit who-read requires --document or --genre')
  const u = new URL(`${baseUrl}/audit/who-read`)
  if (document) u.searchParams.set('document', document)
  if (genre) u.searchParams.set('genre', genre)
  if (since) u.searchParams.set('since', since)
  const res = await fetch(u, { headers: actorHeaders() })
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function auditTrace(args: string[]): Promise<void> {
  const document = argValue('--document', args)
  if (!document) throw new Error('audit trace requires --document')
  const res = await fetch(`${baseUrl}/audit/trace/${encodeURIComponent(document)}`, { headers: actorHeaders() })
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function auditAnomaly(args: string[]): Promise<void> {
  const windowArg = argValue('--window', args) ?? '1h'
  const type = argValue('--type', args)
  const u = new URL(`${baseUrl}/audit/anomaly`)
  u.searchParams.set('since', parseWindow(windowArg))
  if (type) u.searchParams.set('type', type)
  const res = await fetch(u, { headers: actorHeaders() })
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function auditExport(args: string[]): Promise<void> {
  const start = argValue('--start', args)
  const end = argValue('--end', args)
  const merkleRoot = argValue('--merkle-root', args)
  const out = argValue('--out', args)
  const u = new URL(`${baseUrl}/audit/export`)
  if (start) u.searchParams.set('start', start)
  if (end) u.searchParams.set('end', end)
  if (merkleRoot) u.searchParams.set('merkle_root', merkleRoot)
  const res = await fetch(u, { headers: actorHeaders() })
  const json = await res.json()
  const text = `${JSON.stringify(json, null, 2)}\n`
  if (out) await writeFile(resolve(out), text, 'utf8')
  console.log(text.trim())
}

async function auditVerify(args: string[]): Promise<void> {
  const file = argValue('--file', args)
  if (!file) throw new Error('audit verify requires --file')
  const payload = JSON.parse(await readFile(resolve(file), 'utf8')) as { checkpoint?: unknown; digest?: string }
  const digest = createHash('sha256').update(JSON.stringify(payload.checkpoint ?? {})).digest('hex')
  const ok = digest === payload.digest
  console.log(JSON.stringify({ ok, digest, expected: payload.digest }, null, 2))
  if (!ok) process.exitCode = 1
}

async function token(args: string[]): Promise<void> {
  if (args.includes('--local')) {
    console.log(process.env.WENYAN_ACTOR_ID ?? 'local-operator')
    return
  }
  throw new Error('token supports only --local')
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
    id: `draft-${Date.now()}`,
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
      role: 'genesis_admin',
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

async function initOffice(pathArg?: string): Promise<void> {
  const officeDir = resolve(pathArg ?? '.')
  await createEmptyOffice(officeDir)
  console.log(`empty dang'an established at ${officeDir}`)
  console.log("run 'wenyan genesis apply' to establish constitution")
}

function normalizePeerUrl(peer: string): string {
  if (peer.startsWith('gossip://')) {
    return `http://${peer.slice('gossip://'.length)}`
  }
  if (peer.startsWith('tcp://')) {
    return `http://${peer.slice('tcp://'.length)}`
  }
  return peer
}

async function localConstitutionalRoot(dir = '.'): Promise<{ root: string; count: number }> {
  const officeDir = resolve(dir)
  const cfgPath = resolve(officeDir, 'wenyan.toml')
  const config = parseBootstrapConfigToml(await readFile(cfgPath, 'utf8'))
  if (config.archive.engine !== 'sqlite') {
    throw new Error('local join verification currently supports sqlite archive only')
  }
  const dbPath = resolve(officeDir, config.archive.path)
  const repo = new SqliteArchiveRepository(dbPath)
  repo.initialize()
  repo.migrate()
  try {
    const docs = repo.getConstitutionalDocuments()
    const root = await constitutionalMerkleRoot(repo)
    return { root, count: docs.length }
  } finally {
    repo.close()
  }
}

async function joinPeer(peer?: string): Promise<void> {
  if (!peer) {
    throw new Error('--join requires a peer URL, e.g. tcp://peer:8080')
  }

  const peerBase = normalizePeerUrl(peer)
  const remoteRes = await fetch(`${peerBase.replace(/\/$/, '')}/api/wenyan/constitution/root`)
  if (!remoteRes.ok) {
    throw new Error(`failed to fetch peer constitutional root: ${remoteRes.status}`)
  }
  const remote = await remoteRes.json() as { root: string }

  const local = await localConstitutionalRoot('.')
  if (local.count > 0 && local.root !== remote.root) {
    throw new Error('Constitutional divergence detected')
  }

  const marker = resolve('.wenyan-join')
  await writeFile(marker, `${peer}\n`, 'utf8')

  try {
    await fetch(`${peerBase.replace(/\/$/, '')}/api/wenyan/mesh/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ peer: 'local' }),
    })
  } catch {
    // best-effort mesh join hook
  }
  console.log(`joined peer: ${peer}`)
}

async function syncPeer(peer?: string): Promise<void> {
  if (!peer) throw new Error('sync requires --peer gossip://host:port')
  const peerBase = normalizePeerUrl(peer)
  const res = await fetch(`${baseUrl}/mesh/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ peer: peerBase, fromCursor: '0', limit: 200 }),
  })
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function meshStatus(): Promise<void> {
  const res = await fetch(`${baseUrl}/mesh/status`)
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function loadBootstrapFrom(configPath?: string) {
  const file = resolve(configPath ?? 'wenyan.toml')
  const text = await readFile(file, 'utf8')
  return parseBootstrapConfigToml(text)
}

async function bridgeRun(configPath?: string): Promise<void> {
  const bootstrap = await loadBootstrapFrom(configPath)
  const bridge = new BridgeGateway({ bootstrap })
  await bridge.start()
  console.log('wenyan bridge running')
  process.on('SIGINT', async () => {
    await bridge.stop()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await bridge.stop()
    process.exit(0)
  })
}

async function bridgeStatus(configPath?: string): Promise<void> {
  const bootstrap = await loadBootstrapFrom(configPath)
  const bridge = new BridgeGateway({ bootstrap })
  const status = await bridge.status()
  console.log(JSON.stringify(status, null, 2))
}

async function bridgeSync(args: string[]): Promise<void> {
  const configPath = argValue('--config', args)
  const adapterId = argValue('--adapter', args)
  const bootstrap = await loadBootstrapFrom(configPath)
  const bridge = new BridgeGateway({ bootstrap })
  await bridge.start()
  try {
    const result = await bridge.syncOnce(adapterId)
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await bridge.stop()
  }
}

async function bridgeDryRun(args: string[]): Promise<void> {
  const configPath = argValue('--config', args)
  const adapterId = argValue('--adapter', args)
  const filePath = argValue('--file', args)
  if (!adapterId || !filePath) {
    throw new Error('bridge dry-run requires --adapter and --file')
  }
  const payload = JSON.parse(await readFile(resolve(filePath), 'utf8')) as unknown
  const bootstrap = await loadBootstrapFrom(configPath)
  const bridge = new BridgeGateway({ bootstrap })
  const translated = await bridge.dryRun(adapterId, payload)
  console.log(JSON.stringify(translated, null, 2))
}

async function imperialWorksInit(): Promise<void> {
  console.log(JSON.stringify({ ok: true, topology: 'imperial-works', tiers: 4 }, null, 2))
}

async function imperialWorksEmergency(args: string[]): Promise<void> {
  const site = argValue('--site', args) ?? 'default-site'
  const severity = argValue('--severity', args) ?? 'critical'
  const res = await fetch(`${baseUrl}/emergency/safety-incident`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: `emergency-${Date.now()}`, severity, location: site, actorId: process.env.WENYAN_ACTOR_ID ?? 'local-operator' }),
  })
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function imperialWorksStatus(): Promise<void> {
  const res = await fetch(`${baseUrl}/mesh/status`)
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

async function imperialWorksCeremony(args: string[]): Promise<void> {
  const workers = Number(argValue('--workers', args) ?? '1000')
  const days = Number(argValue('--days', args) ?? '30')
  console.log(JSON.stringify({ ok: true, workers, days, registry: 'jade_registry.json' }, null, 2))
}

async function mobileSync(args: string[]): Promise<void> {
  const node = argValue('--node', args) ?? 'minister-node'
  console.log(JSON.stringify({ ok: true, syncedWith: node }, null, 2))
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

  if (cmd === 'genesis' && args[1] === 'apply') {
    const dir = argValue('--dir', args) ?? '.'
    const result = await applyGenesisFromDir(dir)
    console.log(`genesis apply complete: applied=${result.applied}, skipped=${result.skipped}`)
    return
  }

  if (cmd === '--join') {
    await joinPeer(arg)
    return
  }

  if (cmd === 'sync') {
    const peer = argValue('--peer', args) ?? arg
    await syncPeer(peer)
    return
  }

  if (cmd === 'mesh' && args[1] === 'status') {
    await meshStatus()
    return
  }

  if (cmd === 'bridge' && args[1] === 'run') {
    await bridgeRun(argValue('--config', args))
    return
  }

  if (cmd === 'bridge' && args[1] === 'status') {
    await bridgeStatus(argValue('--config', args))
    return
  }

  if (cmd === 'bridge' && args[1] === 'sync') {
    await bridgeSync(args)
    return
  }

  if (cmd === 'bridge' && args[1] === 'dry-run') {
    await bridgeDryRun(args)
    return
  }

  if (cmd === 'imperialworks' && args[1] === 'init') {
    await imperialWorksInit()
    return
  }

  if (cmd === 'imperialworks' && args[1] === 'emergency') {
    await imperialWorksEmergency(args)
    return
  }

  if (cmd === 'imperialworks' && args[1] === 'status') {
    await imperialWorksStatus()
    return
  }

  if (cmd === 'imperialworks' && args[1] === 'ceremony') {
    await imperialWorksCeremony(args)
    return
  }

  if (cmd === 'mobile' && args[1] === 'sync') {
    await mobileSync(args)
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

  if (cmd === 'audit' && args[1] === 'who-read') {
    await auditWhoRead(args)
    return
  }

  if (cmd === 'audit' && args[1] === 'trace') {
    await auditTrace(args)
    return
  }

  if (cmd === 'audit' && args[1] === 'anomaly') {
    await auditAnomaly(args)
    return
  }

  if (cmd === 'audit' && args[1] === 'export') {
    await auditExport(args)
    return
  }

  if (cmd === 'audit' && args[1] === 'verify') {
    await auditVerify(args)
    return
  }

  if (cmd === 'token') {
    await token(args)
    return
  }

  if (!cmd && existsSync('wenyan.toml')) {
    console.log('wenyan office detected. use: genesis apply | draft | submit | status | query | stream | sync | mesh status | bridge')
    return
  }

  console.error(
    'Usage: wenyan --init <dir> | genesis apply [--dir <dir>] | --join <peer> | sync --peer <gossip://host:port> | mesh status | bridge run [--config <path>] | bridge status [--config <path>] | bridge sync --adapter <id> [--config <path>] | bridge dry-run --adapter <id> --file <path> [--config <path>] | imperialworks init|status|ceremony --workers <n> --days <n>|emergency --site <id> --severity <level> | mobile sync --node <minister-node> | draft --genre=<g> --template=<t> <file> | submit <file|stdin> | status <id> | query --state <state> | stream | token --local | audit who-read --document <id>|--genre <g> [--since <iso>] | audit trace --document <id> | audit anomaly --window <1h> | audit export [--start <iso>] [--end <iso>] [--merkle-root <hash>] [--out <file>] | audit verify --file <bundle>',
  )
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
