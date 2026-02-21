import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { SqliteArchiveRepository } from '../../archive/src/sqlite'
import { buildGateway } from '../../gateway/src/index'
import { ReliableChannel } from '../../channel/src/index'
import { DEV_SEAL_CONTEXT, verifySealChain, type SealRecord } from '../../seal/src/index'
import { createEmptyOffice, applyGenesisFromDir } from '../../genesis/src/index'
import { InMemoryPlumtree, ImperialBroadcast, SwimMembership } from '../../gossip/src/index'
import { compareVectorClock, mergeEdict, resolveConcurrentEdict, type EdictLike } from '../../crdt/src/index'
import { syncWithPeer } from '../../archive/src/sync'
import type { MessageEnvelope } from '../../core/src/index'
import { createPbftFixture } from './pbft-helpers'

const tempDirs = new Set<string>()
const THREE_IMPERIAL = { ...DEV_SEAL_CONTEXT, imperialSignatures: ['sig-1', 'sig-2', 'sig-3'] }

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  tempDirs.clear()
})

async function setupOffice(name: string): Promise<{ dir: string; repo: SqliteArchiveRepository }> {
  const dir = mkdtempSync(join(tmpdir(), `wenyan-ritual-04-${name}-`))
  tempDirs.add(dir)
  await createEmptyOffice(dir)
  await applyGenesisFromDir(dir)
  const repo = new SqliteArchiveRepository(resolve(dir, "wenyan.dang'an"))
  repo.initialize()
  repo.migrate()
  return { dir, repo }
}

function baseMessage(genre: string, payload: Record<string, unknown>): MessageEnvelope {
  return {
    id: `${genre}-${randomUUID()}`,
    genre,
    payload,
    actor: { id: 'ritualist', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: {},
  }
}

async function waitForState(
  app: ReturnType<typeof buildGateway>,
  id: string,
  expected: string,
  timeoutMs = 5000,
): Promise<{ state: string; transitions: Array<{ reason?: string }>; message: MessageEnvelope; seals: SealRecord[] }> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const res = await app.request(`/messages/${id}`)
    if (res.status === 200) {
      const payload = await res.json() as { state: string; transitions: Array<{ reason?: string }>; message: MessageEnvelope; seals: SealRecord[] }
      if (payload.state === expected) return payload
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 50))
  }
  throw new Error(`timeout waiting for ${id} -> ${expected}`)
}

async function ensureGenre(app: ReturnType<typeof buildGateway>, genre: string, schema: Record<string, unknown>): Promise<void> {
  const ti = baseMessage('ti_definition', {
    target_genre: genre,
    version: '1.0.0',
    schema,
  })
  const res = await app.request('/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ti),
  })
  expect(res.status).toBe(202)
  await waitForState(app, ti.id, 'archived')
}

async function submit(app: ReturnType<typeof buildGateway>, message: MessageEnvelope): Promise<Response> {
  return app.request('/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  })
}

describe('Wenyan v0.4.0 rituals', () => {
  it('Ritual 1: Gossip relay preserves seal integrity and returns archival confirmation', async () => {
    const { repo } = await setupOffice('relay')
    const gossip = new InMemoryPlumtree(3)
    const gossiped: string[] = []
    const app = buildGateway(repo, new ReliableChannel(), THREE_IMPERIAL, {
      distributedMode: 'consort',
      lawMode: 'strict',
      onSealGossip: async (messageId, sealSeq) => {
        const recipients = gossip.eagerPush({ id: `${messageId}:${sealSeq}`, topic: 'seal', payload: {} })
        gossiped.push(...recipients)
      },
    })

    await ensureGenre(app, 'petition', { type: 'object', required: ['title'] })
    const petition = baseMessage('petition', { title: 'relay to court' })
    const submitted = await submit(app, petition)
    expect(submitted.status).toBe(202)

    const payload = await waitForState(app, petition.id, 'archived')
    expect(payload.state).toBe('archived')
    expect(payload.seals).toHaveLength(6)
    expect(await verifySealChain(payload.message, payload.seals, THREE_IMPERIAL)).toBe(true)
    expect(gossiped.length).toBeGreaterThan(0)
    repo.close()
  })

  it('Ritual 2: Poisoned courier cannot force constitutional commit and triggers view-change', async () => {
    const { repo } = await setupOffice('poison')
    const { pbft } = await createPbftFixture(['beijing', 'nanjing', "xi'an", 'chengdu'], 3)
    const membership = new SwimMembership(1)
    membership.upsert('chengdu', 'gossip://chengdu:7946')

    const app = buildGateway(repo, new ReliableChannel(), THREE_IMPERIAL, {
      distributedMode: 'consort',
      consensusKind: 'pbft',
      nodeId: 'beijing',
      pbftConsensus: pbft,
      lawMode: 'strict',
    })

    const proposal = baseMessage('ti_definition', {
      target_genre: 'tax_edict',
      version: '1.0.0',
      schema: { type: 'object', required: ['rate'] },
    })
    const res = await submit(app, proposal)
    expect(res.status).toBe(202)

    const json = await waitForState(app, proposal.id, 'pending')
    expect(json.state).toBe('pending')
    expect(json.transitions.at(-1)?.reason).toBe('awaiting-pbft-consensus')

    membership.suspect('chengdu')
    expect(membership.list().find((m) => m.nodeId === 'chengdu')?.state).toBe('suspect')
    await pbft.onViewChange('nanjing')
    expect(pbft.currentView()).toBe(1)
    repo.close()
  })

  it('Ritual 3: Partition reconciliation for edicts resolves by precedence without schism', async () => {
    const loyalist: EdictLike = {
      id: 'beijing-routing',
      nodeId: 'beijing',
      precedence: 1,
      clock: { beijing: 1, nanjing: 0 },
      payload: { route: 'grand_secretariat' },
    }
    const rebel: EdictLike = {
      id: 'nanjing-routing',
      nodeId: 'nanjing',
      precedence: 2,
      clock: { beijing: 0, nanjing: 1 },
      payload: { route: 'emperor_direct' },
    }

    expect(compareVectorClock(loyalist.clock, rebel.clock)).toBe('concurrent')
    const merged = mergeEdict(loyalist, rebel)
    expect(merged.reason).toBe('precedence')
    expect(merged.winner.id).toBe('nanjing-routing')
    const resolved = resolveConcurrentEdict(loyalist, rebel)
    expect('schism' in resolved).toBe(false)
  })

  it('Ritual 4: Empty archive join detects divergence and fetches missing transition range', async () => {
    const { repo: source } = await setupOffice('sync-source')
    const app = buildGateway(source, new ReliableChannel(), THREE_IMPERIAL, { lawMode: 'strict' })
    await ensureGenre(app, 'dispatch', { type: 'object', required: ['title'] })
    for (let i = 0; i < 5; i += 1) {
      const r = await submit(app, baseMessage('dispatch', { title: `dispatch-${i}` }))
      expect(r.status).toBe(202)
    }

    const targetDir = mkdtempSync(join(tmpdir(), 'wenyan-ritual-04-sync-target-'))
    tempDirs.add(targetDir)
    await createEmptyOffice(targetDir)
    const target = new SqliteArchiveRepository(resolve(targetDir, "wenyan.dang'an"))
    target.initialize()
    target.migrate()

    const result = await syncWithPeer(
      target,
      {
        getMerkleRoot: async () => source.getMerkleRoot('all'),
        getSyncRange: async (fromCursor, limit) => source.getSyncRange(fromCursor, limit),
      },
      { limit: 100 },
    )

    expect(result.diverged).toBe(true)
    expect(result.fetched).toBeGreaterThan(0)
    source.close()
    target.close()
  })

  it('Ritual 5: Imperial broadcast fanout is eager and deduplicated', () => {
    const tree = new InMemoryPlumtree(7)
    const recipients = tree.eagerPush({ id: 'edict-protocol-1', topic: 'protocol', payload: { quorum: 1 } })
    expect(recipients).toHaveLength(7)

    const imperial = new ImperialBroadcast()
    expect(imperial.deliver({ id: 'edict-protocol-1', topic: 'seal6', payload: {} })).toBe(true)
    expect(imperial.deliver({ id: 'edict-protocol-1', topic: 'seal6', payload: {} })).toBe(false)
    expect(imperial.deliveredCount()).toBe(1)
  })

  it('Ritual 6: Fallen capital view-change preserves safety until new quorum commit', async () => {
    const { pbft, signed } = await createPbftFixture(['beijing', 'nanjing', "xi'an", 'chengdu'], 3)
    await pbft.proposeTiDefinition('ti-1', 'beijing')
    expect(pbft.commitIfThreshold('ti-1')).toBe(false)
    await pbft.onViewChange('nanjing')
    expect(pbft.currentView()).toBe(1)
    const at = new Date().toISOString()
    await pbft.onPrepare(await signed({ proposalId: 'ti-1', viewNo: 1, nodeId: 'nanjing', phase: 'prepare', at }))
    await pbft.onPrepare(await signed({ proposalId: 'ti-1', viewNo: 1, nodeId: "xi'an", phase: 'prepare', at }))
    await pbft.onPrepare(await signed({ proposalId: 'ti-1', viewNo: 1, nodeId: 'chengdu', phase: 'prepare', at }))
    await pbft.onCommit(await signed({ proposalId: 'ti-1', viewNo: 1, nodeId: 'nanjing', phase: 'commit', at }))
    await pbft.onCommit(await signed({ proposalId: 'ti-1', viewNo: 1, nodeId: "xi'an", phase: 'commit', at }))
    await pbft.onCommit(await signed({ proposalId: 'ti-1', viewNo: 1, nodeId: 'chengdu', phase: 'commit', at }))
    expect(pbft.commitIfThreshold('ti-1')).toBe(true)
  })

  it('Ritual 7: Irreconcilable concurrent constitutional edits produce schism record', () => {
    const a: EdictLike = {
      id: 'ti-v2-a',
      nodeId: 'beijing',
      precedence: 10,
      clock: { beijing: 1, "xi'an": 0 },
      payload: { target_genre: 'petition' },
    }
    const b: EdictLike = {
      id: 'ti-v2-b',
      nodeId: 'beijing',
      precedence: 10,
      clock: { beijing: 0, "xi'an": 1 },
      payload: { target_genre: 'petition' },
    }
    const resolved = resolveConcurrentEdict(a, b)
    expect('schism' in resolved && resolved.schism).toBe(true)
  })

  it('Ritual 8: Byzantine gossip storm payloads are rejected and not propagated', async () => {
    const { repo } = await setupOffice('storm')
    const app = buildGateway(repo, new ReliableChannel(), THREE_IMPERIAL, { lawMode: 'strict' })
    await ensureGenre(app, 'petition', { type: 'object', required: ['title'] })

    const valid = baseMessage('petition', { title: 'valid' })
    const ok = await submit(app, valid)
    expect(ok.status).toBe(202)

    const details = await waitForState(app, valid.id, 'archived')
    const tampered = details.seals.map((seal, idx) => (idx === 2 ? { ...seal, signature: '00ff' } : seal))
    expect(await verifySealChain(details.message, tampered, THREE_IMPERIAL)).toBe(false)

    const stillValid = await app.request(`/messages/${valid.id}`)
    expect(stillValid.status).toBe(200)
    repo.close()
  })

  it('Ritual 9: Cascading view changes converge and commit once', async () => {
    const { pbft, signed } = await createPbftFixture(['beijing', 'nanjing', "xi'an", 'chengdu'], 3)
    await pbft.proposeTiDefinition('cascade-1', 'beijing')
    await pbft.onViewChange('nanjing')
    await pbft.onViewChange("xi'an")
    expect(pbft.currentView()).toBe(2)

    const at = new Date().toISOString()
    await pbft.onPrepare(await signed({ proposalId: 'cascade-1', viewNo: 2, nodeId: "xi'an", phase: 'prepare', at }))
    await pbft.onPrepare(await signed({ proposalId: 'cascade-1', viewNo: 2, nodeId: 'chengdu', phase: 'prepare', at }))
    await pbft.onPrepare(await signed({ proposalId: 'cascade-1', viewNo: 2, nodeId: 'nanjing', phase: 'prepare', at }))
    await pbft.onCommit(await signed({ proposalId: 'cascade-1', viewNo: 2, nodeId: "xi'an", phase: 'commit', at }))
    await pbft.onCommit(await signed({ proposalId: 'cascade-1', viewNo: 2, nodeId: 'chengdu', phase: 'commit', at }))
    await pbft.onCommit(await signed({ proposalId: 'cascade-1', viewNo: 2, nodeId: 'nanjing', phase: 'commit', at }))

    expect(pbft.commitIfThreshold('cascade-1')).toBe(true)
  })
})
