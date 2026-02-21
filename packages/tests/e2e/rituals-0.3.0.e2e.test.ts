import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildGateway } from '../../gateway/src/index'
import { SqliteArchiveRepository } from '../../archive/src/sqlite'
import { ReliableChannel, constitutionalMerkleRoot } from '../../channel/src/index'
import { DEV_SEAL_CONTEXT } from '../../seal/src/index'
import { createEmptyOffice, applyGenesisFromDir } from '../../genesis/src/index'
import type { MessageEnvelope } from '../../core/src/index'
import { waitForState, issueToken } from './helpers'

const tempDirs = new Set<string>()

const SINGLE_IMPERIAL = { ...DEV_SEAL_CONTEXT, imperialSignatures: ['sig-1'] }
const THREE_IMPERIAL = { ...DEV_SEAL_CONTEXT, imperialSignatures: ['sig-1', 'sig-2', 'sig-3'] }

function makeOfficeDir (name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `wenyan-${name}-`))
  tempDirs.add(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.clear()
})

function openRepoFromOffice (dir: string): SqliteArchiveRepository {
  const dbPath = resolve(dir, "wenyan.dang'an")
  const repo = new SqliteArchiveRepository(dbPath)
  repo.initialize()
  repo.migrate()
  return repo
}

function seedReadAccessLaw (repo: SqliteArchiveRepository): void {
  const id = `edict-access-control-${randomUUID()}`
  repo.appendMessage({
    id,
    genre: 'edict',
    payload: {
      law_type: 'access_control',
      version: '1.0.0',
      content: {
        anonymous_read: true,
        read_permissions: {
          genesis_admin: ['*'],
        },
        query_hash_only: true,
      },
      precedence: 100,
      effective_date: new Date().toISOString(),
    },
    actor: { id: 'seed', role: 'genesis_admin' },
    submittedAt: new Date().toISOString(),
    metadata: { constitutional: true },
  })
  repo.appendTransition({
    messageId: id,
    fromState: 'pending',
    toState: 'archived',
    sequenceNo: 1,
    actorId: 'seed',
    sealedAt: new Date().toISOString(),
    at: new Date().toISOString(),
    prevTransitionHash: 'GENESIS',
  })
}

function countMessages (dbPath: string): number {
  const db = new DatabaseSync(dbPath)
  const row = db.prepare('SELECT COUNT(*) AS c FROM messages').get() as { c: number }
  db.close()
  return Number(row.c)
}

function countConstitutional (dbPath: string): number {
  const db = new DatabaseSync(dbPath)
  const row = db.prepare('SELECT COUNT(*) AS c FROM messages WHERE constitutional = 1').get() as { c: number }
  db.close()
  return Number(row.c)
}

function constitutionalByGenre (dbPath: string): Array<{ genre: string; c: number }> {
  const db = new DatabaseSync(dbPath)
  const rows = db
    .prepare('SELECT genre, COUNT(*) AS c FROM messages WHERE constitutional = 1 GROUP BY genre ORDER BY genre')
    .all() as Array<{ genre: string; c: number }>
  db.close()
  return rows
}

function firstTiDefinitionId (dbPath: string): string | undefined {
  const db = new DatabaseSync(dbPath)
  const row = db
    .prepare("SELECT id FROM messages WHERE genre = 'ti_definition' AND constitutional = 1 ORDER BY archived_at ASC LIMIT 1")
    .get() as { id?: string } | undefined
  db.close()
  return row?.id
}

function sealCount (dbPath: string, messageId: string): number {
  const db = new DatabaseSync(dbPath)
  const row = db.prepare('SELECT COUNT(*) AS c FROM seals WHERE message_id = ?').get(messageId) as { c: number }
  db.close()
  return Number(row.c)
}

function baseMessage (genre: string, payload: Record<string, unknown>, role = 'genesis_admin'): MessageEnvelope {
  return {
    id: `${genre}-${randomUUID()}`,
    genre,
    payload,
    actor: { id: `ritualist-${randomUUID()}`, role },
    submittedAt: new Date().toISOString(),
    metadata: {},
  }
}

async function submit (app: ReturnType<typeof buildGateway>, message: MessageEnvelope, headers?: Record<string, string>): Promise<Response> {
  return app.request('/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(message),
  })
}

async function waitForState (
  app: ReturnType<typeof buildGateway>,
  id: string,
  expected: string,
  timeoutMs = 5000,
  intervalMs = 50,
  options?: { headers?: Record<string, string> },
): Promise<{ state: string; transitions: Array<{ reason?: string }> }> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const res = await app.request(`/messages/${id}`, {
      headers: options?.headers,
    })
    if (res.status === 200) {
      const body = await res.json() as { state: string; transitions: Array<{ reason?: string }> }
      if (body.state === expected) return body
    }
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 50))
  }
  throw new Error(`timeout waiting for ${id} -> ${expected}`)
}

async function waitForNonArchivedState (
  repo: SqliteArchiveRepository,
  id: string,
  timeoutMs = 5000,
): Promise<string | undefined> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const state = repo.snapshotState(id)
    if (state && state !== 'pending') return state
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 50))
  }
  return repo.snapshotState(id)
}

async function waitForGenreSchema (
  repo: SqliteArchiveRepository,
  genre: string,
  timeoutMs = 5000,
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const schema = await repo.getCurrentTiDefinition(genre)
    if (schema) return
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 50))
  }
  throw new Error(`timeout waiting for Ti definition: ${genre}`)
}

describe('Wenyan v0.3.0 rituals', () => {
  it('Ritual 1: Empty Wenyan rejects undefined genre and keeps archive empty', async () => {
    const dir = makeOfficeDir('void')
    await createEmptyOffice(dir)
    const dbPath = resolve(dir, "wenyan.dang'an")
    const repo = openRepoFromOffice(dir)
    const app = buildGateway(repo, new ReliableChannel(), SINGLE_IMPERIAL, { lawMode: 'strict' })

    const health = await app.request('/constitution/root')
    expect(health.status).toBe(200)
    expect(await health.json()).toMatchObject({ count: 0 })

    const res = await submit(app, baseMessage('petition', { title: 'empty office' }))
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'Schema Undefined', genre: 'petition' })
    expect(countMessages(dbPath)).toBe(0)
    repo.close()
  })

  it('Ritual 2: Genesis apply seeds constitution idempotently and enables normal flow', async () => {
    const dir = makeOfficeDir('genesis')
    await createEmptyOffice(dir)
    const dbPath = resolve(dir, "wenyan.dang'an")

    const first = await applyGenesisFromDir(dir)
    expect(first.applied).toBe(9)
    const second = await applyGenesisFromDir(dir)
    expect(second.applied).toBe(0)

    expect(countConstitutional(dbPath)).toBe(9)
    expect(constitutionalByGenre(dbPath)).toEqual([
      { genre: 'edict', c: 7 },
      { genre: 'ti_definition', c: 2 },
    ])

    const tiId = firstTiDefinitionId(dbPath)
    expect(tiId).toBeDefined()
    expect(sealCount(dbPath, tiId!)).toBeGreaterThan(0)

    const repo = openRepoFromOffice(dir)
    seedReadAccessLaw(repo)
    const app = buildGateway(repo, new ReliableChannel(), THREE_IMPERIAL, { lawMode: 'strict' })

    const addPetitionTi = await submit(
      app,
      baseMessage('ti_definition', {
        target_genre: 'petition',
        version: '1.0.0',
        schema: { type: 'object', required: ['title'] },
      }),
      { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` }
    )
    expect(addPetitionTi.status).toBe(202)
    const addPetitionTiId = (await addPetitionTi.json() as { id: string }).id
    await waitForState(app, addPetitionTiId, 'archived', 5000, 50, {
      headers: { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` },
    })
    await waitForGenreSchema(repo, 'petition')

    const petition = await submit(app, baseMessage('petition', { title: 'after genesis' }), { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` })
    expect(petition.status).toBe(202)
    const petitionId = (await petition.json() as { id: string }).id
    await waitForState(app, petitionId, 'archived', 5000, 50, {
      headers: { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` },
    })
    repo.close()
  })

  it('Ritual 3: ti_definition enforces higher imperial threshold', async () => {
    const dir = makeOfficeDir('threshold')
    await createEmptyOffice(dir)
    await applyGenesisFromDir(dir)
    const dbPath = resolve(dir, "wenyan.dang'an")

    const repoSingle = openRepoFromOffice(dir)
    seedReadAccessLaw(repoSingle)
    const appSingle = buildGateway(repoSingle, new ReliableChannel(), SINGLE_IMPERIAL, { lawMode: 'strict' })
    const blocked = await submit(
      appSingle,
      baseMessage('ti_definition', {
        target_genre: 'dispatch',
        version: '1.0.0',
        schema: { type: 'object', required: ['title'] },
      }),
    )
    expect(blocked.status).toBe(202)
    const blockedId = (await blocked.json() as { id: string }).id
    const blockedState = await waitForState(appSingle, blockedId, 'rejected')
    expect(blockedState.transitions.at(-1)?.reason).toBe('insufficient-imperial-authority')
    repoSingle.close()

    const repoThree = openRepoFromOffice(dir)
    seedReadAccessLaw(repoThree)
    const appThree = buildGateway(repoThree, new ReliableChannel(), THREE_IMPERIAL, { lawMode: 'strict' })
    const accepted = await submit(
      appThree,
      baseMessage('ti_definition', {
        target_genre: 'dispatch',
        version: '1.0.0',
        schema: { type: 'object', required: ['title'] },
      }),
    )
    expect(accepted.status).toBe(202)
    const body = (await accepted.json()) as { id: string }
    await waitForState(appThree, body.id, 'archived')

    const db = new DatabaseSync(dbPath)
    const row = db
      .prepare('SELECT constitutional, superseded_by FROM messages WHERE id = ?')
      .get(body.id) as { constitutional: number; superseded_by: string | null }
    db.close()
    expect(row.constitutional).toBe(1)
    expect(row.superseded_by).toBeNull()
    repoThree.close()
  }, 15_000)

  it('Ritual 4: dangling edict target_genre fails constitutional reference checks', async () => {
    const dir = makeOfficeDir('edict-boundary')
    await createEmptyOffice(dir)
    await applyGenesisFromDir(dir)

    const repo = openRepoFromOffice(dir)
    seedReadAccessLaw(repo)
    const app = buildGateway(repo, new ReliableChannel(), SINGLE_IMPERIAL, { lawMode: 'strict' })
    const edict = baseMessage('edict', {
      law_type: 'routing',
      version: '1.0.0',
      content: { table: { phantom: ['x'] }, broadcast_policy: 'hierarchical' },
      precedence: 1,
      effective_date: new Date().toISOString(),
      target_genre: 'phantom',
    })
    const res = await submit(app, edict)
    expect(res.status).toBe(202)

    const details = await waitForState(app, edict.id, 'rejected')
    expect(details.state).toBe('rejected')
    expect(details.transitions.at(-1)?.reason).toBe('invalid-constitutional-reference')
    repo.close()
  })

  it('Ritual 5: protocol update affects subsequent submissions', async () => {
    const dir = makeOfficeDir('snapshot')
    await createEmptyOffice(dir)
    await applyGenesisFromDir(dir)
    const repo = openRepoFromOffice(dir)
    seedReadAccessLaw(repo)
    const app = buildGateway(repo, new ReliableChannel(), THREE_IMPERIAL, { lawMode: 'strict' })

    const addPetitionTi = await submit(
      app,
      baseMessage('ti_definition', {
        target_genre: 'petition',
        version: '1.0.0',
        schema: { type: 'object', required: ['title', 'routing'] },
      }),
      { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` }
    )
    expect(addPetitionTi.status).toBe(202)
    const addPetitionTiId = (await addPetitionTi.json() as { id: string }).id
    await waitForState(app, addPetitionTiId, 'archived', 5000, 50, {
      headers: { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` },
    })
    await waitForGenreSchema(repo, 'petition')

    const protocolTwo = baseMessage('edict', {
      law_type: 'protocol',
      version: '1.1.0',
      content: { required_acks_by_genre: { petition: 2 } },
      precedence: 10,
      effective_date: '2026-01-01T00:00:00.000Z',
    })
    const protocolTwoRes = await submit(app, protocolTwo, { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` })
    expect(protocolTwoRes.status).toBe(202)
    await waitForState(app, protocolTwo.id, 'archived', 5000, 50, {
      headers: { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` },
    })

    const msgA = baseMessage('petition', {
      title: 'A',
      routing: { destination: ['office-a', 'office-b'] },
    })
    expect((await submit(app, msgA, { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` })).status).toBe(202)
    const aJson = await waitForState(app, msgA.id, 'pending', 5000, 50, {
      headers: { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` },
    })
    expect(aJson.state).toBe('pending')

    const protocolOne = baseMessage('edict', {
      law_type: 'protocol',
      version: '1.2.0',
      content: { required_acks_by_genre: { petition: 1 } },
      precedence: 20,
      effective_date: '2026-01-01T00:00:01.000Z',
      superseded_edict_id: protocolTwo.id,
    })
    const protocolOneRes = await submit(app, protocolOne, { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` })
    expect(protocolOneRes.status).toBe(202)
    await waitForState(app, protocolOne.id, 'archived', 5000, 50, {
      headers: { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` },
    })

    const msgB = baseMessage('petition', {
      title: 'B',
      routing: { destination: ['office-a', 'office-b'] },
    })
    expect((await submit(app, msgB, { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` })).status).toBe(202)
    const bJson = await waitForState(app, msgB.id, 'archived', 5000, 50, {
      headers: { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` },
    })
    expect(bJson.state).toBe('archived')
    repo.close()
  })

  it('Ritual 6: constitutional Merkle roots detect divergence', async () => {
    const dirA = makeOfficeDir('merkle-a')
    const dirB = makeOfficeDir('merkle-b')
    await createEmptyOffice(dirA)
    await createEmptyOffice(dirB)
    await applyGenesisFromDir(dirA)

    const repoA = openRepoFromOffice(dirA)
    const repoB = openRepoFromOffice(dirB)
    const rootA = await constitutionalMerkleRoot(repoA)
    const rootB = await constitutionalMerkleRoot(repoB)
    expect(rootA).not.toBe(rootB)

    const appB = buildGateway(repoB, new ReliableChannel(), SINGLE_IMPERIAL, { lawMode: 'strict' })
    const preSync = await submit(appB, baseMessage('petition', { title: 'before sync' }), { authorization: `Bearer ${issueToken('ritual-actor', 'genesis_admin')}` })
    expect(preSync.status).toBe(503)

    repoA.close()
    repoB.close()

    const dbA = resolve(dirA, "wenyan.dang'an")
    const dbB = resolve(dirB, "wenyan.dang'an")
    copyFileSync(dbA, dbB)

    const syncedB = openRepoFromOffice(dirB)
    const syncedRoot = await constitutionalMerkleRoot(syncedB)
    const reOpenA = openRepoFromOffice(dirA)
    const rootA2 = await constitutionalMerkleRoot(reOpenA)
    expect(syncedRoot).toBe(rootA2)
    reOpenA.close()

    const db = new DatabaseSync(dbB)
    db.exec(`
      UPDATE messages
      SET archived_at = '2099-01-01T00:00:00.000Z'
      WHERE id = (
        SELECT id FROM messages WHERE constitutional = 1 ORDER BY archived_at, id LIMIT 1
      )
    `)
    db.close()
    const tamperedRoot = await constitutionalMerkleRoot(syncedB)
    expect(tamperedRoot).not.toBe(rootA2)
    syncedB.close()
  })

  it('Ritual 7: package separation keeps @andrey-kokoev/wenyan-core independent from @andrey-kokoev/wenyan-genesis', () => {
    const corePkg = JSON.parse(readFileSync(resolve(process.cwd(), '../core/package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    expect(corePkg.dependencies?.['@andrey-kokoev/wenyan-genesis']).toBeUndefined()
    expect(corePkg.devDependencies?.['@andrey-kokoev/wenyan-genesis']).toBeUndefined()

    const coreExports = readFileSync(resolve(process.cwd(), '../core/src/index.ts'), 'utf8')
    expect(coreExports.includes('@andrey-kokoev/wenyan-genesis')).toBe(false)
  })

  it('Ritual 8: corrupt archive fails startup, with no in-memory fallback', () => {
    const dir = makeOfficeDir('corrupt')
    const dbPath = resolve(dir, "wenyan.dang'an")
    writeFileSync(dbPath, 'not-a-sqlite-database', 'utf8')
    expect(() => new SqliteArchiveRepository(dbPath)).toThrow()
  })
})
