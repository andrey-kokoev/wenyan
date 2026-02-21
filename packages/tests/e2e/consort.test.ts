import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SqliteArchiveRepository } from '../../archive/src/sqlite'
import { buildGateway } from '../../gateway/src/index'
import { ReliableChannel } from '../../channel/src/index'
import { DEV_SEAL_CONTEXT } from '../../seal/src/index'
import { createEmptyOffice, applyGenesisFromDir } from '../../genesis/src/index'
import { SwimMembership } from '../../gossip/src/index'
import { createPbftFixture } from './pbft-helpers'

const tempDirs = new Set<string>()

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  tempDirs.clear()
})

async function setupOffice(name: string): Promise<{ dir: string; repo: SqliteArchiveRepository }> {
  const dir = mkdtempSync(join(tmpdir(), `wenyan-consort-${name}-`))
  tempDirs.add(dir)
  await createEmptyOffice(dir)
  await applyGenesisFromDir(dir)
  const repo = new SqliteArchiveRepository(resolve(dir, "wenyan.dang'an"))
  repo.initialize()
  repo.migrate()
  return { dir, repo }
}

async function waitForState(
  app: ReturnType<typeof buildGateway>,
  id: string,
  expected: string,
  timeoutMs = 5000,
): Promise<{ state: string; transitions: Array<{ reason?: string }> }> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const status = await app.request(`/messages/${id}`)
    if (status.status === 200) {
      const payload = await status.json() as { state: string; transitions: Array<{ reason?: string }> }
      if (payload.state === expected) return payload
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 50))
  }
  throw new Error(`timeout waiting for ${id} -> ${expected}`)
}

describe('Consort protocol', () => {
  it('keeps single mode strict gateway behavior', async () => {
    const { repo } = await setupOffice('single')
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { distributedMode: 'single', lawMode: 'strict' })

    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'm-single-1',
        genre: 'petition',
        payload: { body: 'hello' },
        actor: { id: 'a', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'Schema Undefined', genre: 'petition' })
    repo.close()
  })

  it('exposes mesh join/sync/status endpoints in consort mode', async () => {
    const { repo } = await setupOffice('mesh')
    const membership = new SwimMembership(5000)
    const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, {
      distributedMode: 'consort',
      lawMode: 'strict',
      meshMembers: () => membership.list(),
      meshPartitioned: () => membership.isPartitioned(),
      onMeshJoin: async (peer) => {
        membership.upsert(peer, peer)
        return { ok: true, detail: `joined ${peer}` }
      },
      onMeshSync: async () => ({ ok: true, fetched: 0 }),
    })

    const joinRes = await app.request('/mesh/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ peer: 'gossip://node-b:7946' }),
    })
    expect(joinRes.status).toBe(200)

    const statusRes = await app.request('/mesh/status')
    expect(statusRes.status).toBe(200)
    expect(await statusRes.json()).toMatchObject({ mode: 'consort' })

    const rootRes = await app.request('/mesh/merkle-root')
    expect(rootRes.status).toBe(200)

    const syncRes = await app.request('/mesh/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ peer: 'gossip://node-b:7946', fromCursor: '0', limit: 10 }),
    })
    expect(syncRes.status).toBe(200)

    repo.close()
  })

  it('gates ti_definition archival behind pbft threshold in consort pbft mode', async () => {
    const { repo } = await setupOffice('pbft')
    const { pbft } = await createPbftFixture(['node-a', 'node-b', 'node-c', 'node-d'], 3)

    const app = buildGateway(repo, new ReliableChannel(), { ...DEV_SEAL_CONTEXT, imperialSignatures: ['sig-a', 'sig-b', 'sig-c'] }, {
      distributedMode: 'consort',
      consensusKind: 'pbft',
      pbftConsensus: pbft,
      nodeId: 'node-a',
      lawMode: 'strict',
    })

    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'ti-pbft-1',
        genre: 'ti_definition',
        payload: {
          target_genre: 'dispatch',
          version: '1.0.0',
          schema: { type: 'object', required: ['body'] },
        },
        actor: { id: 'a', role: 'genesis_admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(202)

    const payload = await waitForState(app, 'ti-pbft-1', 'pending')
    expect(payload.state).toBe('pending')
    expect(payload.transitions.at(-1)?.reason).toBe('awaiting-pbft-consensus')

    repo.close()
  })
})
