#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
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

async function initOffice(pathArg?: string): Promise<void> {
  const officeDir = resolve(pathArg ?? '.')
  await mkdir(officeDir, { recursive: true })

  const dbPath = resolve(officeDir, "wenyan.dang'an")
  const cfgPath = resolve(officeDir, 'wenyan.toml')

  const repo = new SqliteArchiveRepository(dbPath)
  repo.initialize()
  repo.migrate()
  repo.close()

  const config = `[seal]\nthreshold = 6\nenabled_stages = ["caoni", "shenfu", "pizhun"]\n\n[archive]\npath = "./wenyan.dang'an"\nretention_days = 3650\n\n[routing]\nsubmit_path = "/api/wenyan/messages"\nstatus_path = "/api/wenyan/messages/:id"\nstream_path = "/api/wenyan/stream"\nupstream = "http://127.0.0.1:8787"\ngateway_port = 8080\n\n[authorization]\nmode = "strict"\n\n[genesis]\nkey_id = "${randomUUID()}"\n`

  await writeFile(cfgPath, config, 'utf8')
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

  if (cmd === 'query' && arg) {
    await query(arg)
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

  console.error('Usage: wenyan --init <dir> | --join <peer> | draft --genre=<g> --template=<t> <file> | submit <file|stdin> | status <id> | query <state> | stream')
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
