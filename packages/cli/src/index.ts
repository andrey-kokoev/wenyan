#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { constitutionalMerkleRoot } from '@wenyan/channel'
import { createEmptyOffice, applyGenesisFromDir } from '@wenyan/genesis'
import { parseBootstrapConfigToml } from '@wenyan/core'
import { SqliteArchiveRepository } from '@wenyan/archive/sqlite'

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
    console.log('wenyan office detected. use: genesis apply | draft | submit | status | query | stream | sync | mesh status')
    return
  }

  console.error(
    'Usage: wenyan --init <dir> | genesis apply [--dir <dir>] | --join <peer> | sync --peer <gossip://host:port> | mesh status | draft --genre=<g> --template=<t> <file> | submit <file|stdin> | status <id> | query --state <state> | stream',
  )
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
