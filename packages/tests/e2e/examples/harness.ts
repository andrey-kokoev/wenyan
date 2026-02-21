import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildGateway } from '../../../../packages/gateway/src/index'
import { withAuth, waitForState } from '../helpers'
export { waitForState }
import { SqliteArchiveRepository } from '../../../../packages/archive/src/sqlite'
import { ReliableChannel } from '../../../../packages/channel/src/index'
import { DEV_SEAL_CONTEXT } from '../../../../packages/seal/src/index'
import { createEmptyOffice, applyGenesisFromDir } from '../../../../packages/genesis/src/index'
import type { MessageEnvelope } from '../../../../packages/core/src/index'
import { ritualNumbers } from './fixtures'

const dirs = new Set<string>()

export function cleanupHarness (): void {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.clear()
}

export async function setupExampleOffice (name: string): Promise<{ repo: SqliteArchiveRepository; app: ReturnType<typeof buildGateway>; dir: string }> {
  const dir = mkdtempSync(join(tmpdir(), `wenyan-examples-${name}-`))
  dirs.add(dir)
  await createEmptyOffice(dir)
  await applyGenesisFromDir(dir)
  const repo = new SqliteArchiveRepository(resolve(dir, "wenyan.dang'an"))
  repo.initialize()
  repo.migrate()
  const app = withAuth(buildGateway(repo, new ReliableChannel(), { ...DEV_SEAL_CONTEXT, imperialSignatures: ['sig-1', 'sig-2', 'sig-3'] }, {
    lawMode: 'strict',
    distributedMode: 'consort',
    consensusKind: 'none',
    nodeId: `${name}-node`,
  }))
  return { repo, app, dir }
}

export function message (id: string, genre: string, payload: Record<string, unknown>, metadata: Record<string, unknown> = {}): MessageEnvelope {
  return {
    id,
    genre,
    payload,
    actor: { id: 'example-actor', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata,
  }
}

export async function submit (app: ReturnType<typeof buildGateway>, msg: MessageEnvelope): Promise<Response> {
  return app.request('/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(msg),
  })
}

export async function ensureGenre (app: ReturnType<typeof buildGateway>, genre: string, required: string[] = []): Promise<void> {
  const id = `ti-${genre}-${Date.now()}`
  const msg = message(id, 'ti_definition', {
    target_genre: genre,
    version: '1.0.0',
    schema: { type: 'object', required },
  })
  msg.actor.id = `ensure-genre-${Date.now()}`
  const res = await submit(app, msg)
  if (res.status !== 202) throw new Error(`failed to ensure genre ${genre}: ${res.status}`)
  await waitForState(app, id, 'archived')
}

export async function allowGenres (app: ReturnType<typeof buildGateway>, genres: string[]): Promise<void> {
  const precedence = ritualNumbers.r1.pbftThreshold
  const id = `admission-${Date.now()}`
  const msg = message(id, 'edict', {
    law_type: 'admission',
    version: '1.0.0',
    content: { allowed_genres: genres },
    precedence,
    effective_date: new Date().toISOString(),
  })
  msg.actor.id = `allow-genres-${Date.now()}`
  const res = await submit(app, msg)
  if (res.status !== 202) throw new Error(`failed to set admission law: ${res.status}`)
  await waitForState(app, id, 'archived')
}
