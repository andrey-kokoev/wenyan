import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { buildGateway } from '../../gateway/src/index'
import { SqliteArchiveRepository } from '../../archive/src/sqlite'
import { ReliableChannel } from '../../channel/src/index'
import { DEV_SEAL_CONTEXT } from '../../seal/src/index'
import type { EdictLawType, MessageEnvelope } from '../../core/src/index'

const tempFiles = new Set<string>()
const IMPERIAL_CONTEXT = { ...DEV_SEAL_CONTEXT, imperialSignatures: ['sig-a', 'sig-b', 'sig-c'] }

function trackDbFile(file: string): void {
  tempFiles.add(file)
}

function removeDbArtifacts(file: string): void {
  if (existsSync(file)) unlinkSync(file)
  if (existsSync(`${file}-wal`)) unlinkSync(`${file}-wal`)
  if (existsSync(`${file}-shm`)) unlinkSync(`${file}-shm`)
}

afterEach(() => {
  for (const file of tempFiles) {
    removeDbArtifacts(file)
  }
  tempFiles.clear()
})

function tempDbPath(name: string): string {
  const file = `.tmp-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
  trackDbFile(file)
  return file
}

function createRepo(name: string): { repo: SqliteArchiveRepository; file: string } {
  const file = tempDbPath(name)
  const repo = new SqliteArchiveRepository(file)
  repo.initialize()
  repo.migrate()
  return { repo, file }
}

function tableCount(file: string, table: 'messages' | 'edict_index' | 'ti_definition_index'): number {
  const db = new DatabaseSync(file)
  const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }
  db.close()
  return Number(row.c)
}

function envelope(
  input: Partial<MessageEnvelope> & Pick<MessageEnvelope, 'id' | 'genre' | 'payload'>,
): MessageEnvelope {
  return {
    id: input.id,
    genre: input.genre,
    payload: input.payload,
    actor: input.actor ?? { id: 'ritualist', role: 'admin' },
    submittedAt: input.submittedAt ?? new Date().toISOString(),
    metadata: input.metadata ?? {},
  }
}

function makeTiDefinition(
  id: string,
  targetGenre: string,
  schema: Record<string, unknown>,
  supersededBy?: string,
): MessageEnvelope {
  return envelope({
    id,
    genre: 'ti_definition',
    payload: {
      target_genre: targetGenre,
      version: '1.0.0',
      schema,
      ...(supersededBy ? { superseded_by: supersededBy } : {}),
    },
  })
}

function makeEdict(
  id: string,
  lawType: EdictLawType,
  content: Record<string, unknown>,
  precedence = 0,
  effectiveDate = new Date().toISOString(),
  supersededEdictId?: string,
): MessageEnvelope {
  return envelope({
    id,
    genre: 'edict',
    payload: {
      law_type: lawType,
      version: '1.0.0',
      content,
      precedence,
      effective_date: effectiveDate,
      ...(supersededEdictId ? { superseded_edict_id: supersededEdictId } : {}),
    },
  })
}

function archiveSeed(repo: SqliteArchiveRepository, message: MessageEnvelope, sealedAt?: string): void {
  if (repo.getMessage(message.id)) return
  const at = sealedAt ?? new Date().toISOString()
  repo.appendMessage(message)
  repo.appendTransition({
    messageId: message.id,
    fromState: 'pending',
    toState: 'archived',
    sequenceNo: 1,
    actorId: message.actor.id,
    sealedAt: at,
    prevTransitionHash: 'GENESIS',
    at,
  })
}

function seedGenesisConstitution(repo: SqliteArchiveRepository): void {
  if (!repo.getActiveGenreSchema('ti_definition')) {
    archiveSeed(
      repo,
      makeTiDefinition('genesis-ti-ti_definition', 'ti_definition', {
        type: 'object',
        required: ['target_genre', 'version', 'schema'],
      }),
      '2026-01-01T00:00:00.000Z',
    )
  }

  if (!repo.getActiveGenreSchema('edict')) {
    archiveSeed(
      repo,
      makeTiDefinition('genesis-ti-edict', 'edict', {
        type: 'object',
        required: ['law_type', 'version', 'content', 'precedence', 'effective_date'],
      }),
      '2026-01-01T00:00:01.000Z',
    )
  }

  const nowIso = new Date().toISOString()
  const base: Partial<Record<EdictLawType, Record<string, unknown>>> = {
    appointment: {
      roles: {
        admin: {
          permissions: ['draft', 'review', 'authorize'],
          allowed_genres: ['*'],
          max_pending: 1000,
        },
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

  const seededLawTypes: EdictLawType[] = ['appointment', 'classification', 'routing', 'admission', 'protocol', 'regulation']
  for (const lawType of seededLawTypes) {
    if (repo.getCurrentLaw(lawType, nowIso)) continue
    archiveSeed(
      repo,
      makeEdict(`genesis-edict-${lawType}`, lawType, base[lawType] ?? {}, 0, '2026-01-01T00:00:10.000Z'),
      '2026-01-01T00:00:10.000Z',
    )
  }
}

function seedGenreDefinition(repo: SqliteArchiveRepository, genre: string, required: string[] = []): void {
  if (repo.getActiveGenreSchema(genre)) return
  archiveSeed(
    repo,
    makeTiDefinition(`ti-${genre}-seed-${randomUUID()}`, genre, {
      type: 'object',
      required,
    }),
    '2026-01-01T00:00:20.000Z',
  )
}

function petitionMessage(input: {
  id?: string
  role?: string
  actorId?: string
  payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
} = {}): MessageEnvelope {
  return envelope({
    id: input.id ?? `msg-${randomUUID()}`,
    genre: 'petition',
    payload: input.payload ?? { title: 'memorial', body: 'river works' },
    actor: { id: input.actorId ?? 'scholar', role: input.role ?? 'admin' },
    submittedAt: new Date().toISOString(),
    metadata: input.metadata ?? {},
  })
}

async function submit(app: ReturnType<typeof buildGateway>, message: Record<string, unknown>): Promise<Response> {
  return app.request('/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  })
}

async function readState(app: ReturnType<typeof buildGateway>, id: string): Promise<{
  state: string
  transitions: Array<{ reason?: string }>
  message: MessageEnvelope
}> {
  const res = await app.request(`/messages/${id}`)
  expect(res.status).toBe(200)
  return (await res.json()) as {
    state: string
    transitions: Array<{ reason?: string }>
    message: MessageEnvelope
  }
}

function lastReason(transitions: Array<{ reason?: string }>): string | undefined {
  const last = transitions[transitions.length - 1]
  return last?.reason
}

function isoPlusHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

describe('Ritual 1: Grand Secretariat Establishment (Genesis Bootstrap)', () => {
  it('requires law bootstrap in strict mode, then seeds constitution idempotently', async () => {
    const { repo, file } = createRepo('ritual3-genesis')

    const preBootstrap = buildGateway(repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })
    const rejected = await submit(preBootstrap, petitionMessage())
    expect(rejected.status).toBe(503)
    expect((await rejected.json() as { error: string }).error).toBe('Schema Undefined')

    seedGenesisConstitution(repo)
    const messagesBefore = tableCount(file, 'messages')
    const edictsBefore = tableCount(file, 'edict_index')
    const tiBefore = tableCount(file, 'ti_definition_index')

    expect(tiBefore).toBe(2)
    expect(edictsBefore).toBe(6)

    seedGenesisConstitution(repo)
    expect(tableCount(file, 'messages')).toBe(messagesBefore)
    expect(tableCount(file, 'edict_index')).toBe(edictsBefore)
    expect(tableCount(file, 'ti_definition_index')).toBe(tiBefore)

    seedGenreDefinition(repo, 'petition')
    const app = buildGateway(repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })
    const accepted = await submit(app, petitionMessage())
    expect(accepted.status).toBe(201)
    const body = await accepted.json() as { id: string }
    const state = await readState(app, body.id)
    expect(state.state).toBe('archived')

    repo.close()
  })
})

describe('Ritual 2: Imperial Catalogue (Ti Definition Creation)', () => {
  it('enforces archived Ti schema once promulgated', async () => {
    const { repo } = createRepo('ritual3-ti')
    seedGenesisConstitution(repo)
    const app = buildGateway(repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })

    const beforeTi = await submit(app, petitionMessage({
      payload: { body: 'accepted before ti definition' },
    }))
    expect(beforeTi.status).toBe(503)
    expect((await beforeTi.json() as { error: string }).error).toBe('Schema Undefined')

    const tiId = `ti-petition-v1-${randomUUID()}`
    const tiRes = await submit(
      app,
      makeTiDefinition(tiId, 'petition', {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
      }),
    )
    expect(tiRes.status).toBe(201)

    const badPetition = await submit(app, petitionMessage({
      payload: { body: 'missing title now fails' },
    }))
    expect(badPetition.status).toBe(400)
    expect((await badPetition.json() as { error: string }).error).toBe('schema-noncompliant')

    const goodPetition = await submit(app, petitionMessage({
      payload: { title: 'new form', body: 'conforms' },
    }))
    expect(goodPetition.status).toBe(201)

    const schema = repo.getActiveGenreSchema('petition') as { required?: string[] } | undefined
    expect(schema?.required).toEqual(['title'])

    repo.close()
  })
})

describe('Ritual 3: Appointment Edict (Governance without Structure Change)', () => {
  it('applies role permissions from appointment law and respects effective_date', async () => {
    const { repo } = createRepo('ritual3-appointment')
    seedGenesisConstitution(repo)
    seedGenreDefinition(repo, 'petition', ['title'])
    const app = buildGateway(repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })

    const activeLawId = `edict-appointment-active-${randomUUID()}`
    const activeLaw = await submit(
      app,
      makeEdict(
        activeLawId,
        'appointment',
        {
          roles: {
            admin: { permissions: ['draft', 'review', 'authorize'], allowed_genres: ['*'] },
            censor: { permissions: ['review'], allowed_genres: ['petition'] },
            clerk: { permissions: ['draft'], allowed_genres: ['petition'] },
          },
        },
        1,
      ),
    )
    expect(activeLaw.status).toBe(201)

    const clerkRes = await submit(app, petitionMessage({ role: 'clerk', actorId: 'clerk_01' }))
    expect(clerkRes.status).toBe(201)
    const clerkId = (await clerkRes.json() as { id: string }).id
    const clerkState = await readState(app, clerkId)
    expect(clerkState.state).toBe('rejected')
    expect(lastReason(clerkState.transitions)).toBe('actor-cannot-review')

    const censorRes = await submit(app, petitionMessage({ role: 'censor', actorId: 'censor_01' }))
    expect(censorRes.status).toBe(201)
    const censorId = (await censorRes.json() as { id: string }).id
    const censorState = await readState(app, censorId)
    expect(censorState.state).toBe('rejected')
    expect(lastReason(censorState.transitions)).toBe('actor-cannot-authorize')

    const futureLawId = `edict-appointment-future-${randomUUID()}`
    const futureLaw = await submit(
      app,
      makeEdict(
        futureLawId,
        'appointment',
        {
          roles: {
            admin: { permissions: [], allowed_genres: [] },
          },
        },
        99,
        isoPlusHours(24),
        activeLawId,
      ),
    )
    expect(futureLaw.status).toBe(201)

    const adminRes = await submit(app, petitionMessage({ role: 'admin', actorId: 'admin_01' }))
    expect(adminRes.status).toBe(201)
    const adminId = (await adminRes.json() as { id: string }).id
    const adminState = await readState(app, adminId)
    expect(adminState.state).toBe('archived')

    const nowLaw = repo.getCurrentLaw('appointment', new Date().toISOString())
    expect(nowLaw?.messageId).toBe(activeLawId)

    repo.close()
  })
})

describe('Ritual 4: Constitutional Amendment (Superseding Ti)', () => {
  it('selects latest non-superseded ti_definition and preserves historical documents', async () => {
    const { repo } = createRepo('ritual3-amendment')
    seedGenesisConstitution(repo)
    const app = buildGateway(repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })

    const tiV1 = `ti-petition-v1-${randomUUID()}`
    const v1Res = await submit(
      app,
      makeTiDefinition(tiV1, 'petition', {
        type: 'object',
        required: ['title'],
      }),
    )
    expect(v1Res.status).toBe(201)

    const v1DocRes = await submit(app, petitionMessage({ payload: { title: 'legacy petition' } }))
    expect(v1DocRes.status).toBe(201)
    const v1DocId = (await v1DocRes.json() as { id: string }).id

    const tiV2 = `ti-petition-v2-${randomUUID()}`
    const v2Res = await submit(
      app,
      makeTiDefinition(tiV2, 'petition', {
        type: 'object',
        required: ['title', 'urgency'],
      }, tiV1),
    )
    expect(v2Res.status).toBe(201)

    const active = repo.getActiveGenreSchema('petition') as { required?: string[] } | undefined
    expect(active?.required).toEqual(['title', 'urgency'])

    const obsolete = await submit(app, petitionMessage({ payload: { title: 'old form now obsolete' } }))
    expect(obsolete.status).toBe(400)
    expect((await obsolete.json() as { error: string }).error).toBe('schema-noncompliant')

    const historical = await readState(app, v1DocId)
    expect(historical.state).toBe('archived')
    expect(repo.stateAt(v1DocId, new Date().toISOString())).toBe('archived')
    expect((repo.getMessage(tiV1)?.payload as { version?: string }).version).toBe('1.0.0')

    repo.close()
  })
})

describe('Ritual 5: Precedence Conflict (Edict Override)', () => {
  it('resolves active routing law by precedence and applies supersession', async () => {
    const { repo } = createRepo('ritual3-precedence')
    seedGenesisConstitution(repo)
    seedGenreDefinition(repo, 'petition', ['title'])
    const app = buildGateway(repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })

    const edict1 = `edict-routing-1-${randomUUID()}`
    const e1 = await submit(
      app,
      makeEdict(
        edict1,
        'routing',
        {
          table: { petition: ['grand_secretariat'] },
          broadcast_policy: 'hierarchical',
        },
        1,
      ),
    )
    expect(e1.status).toBe(201)

    const blocked = await submit(app, petitionMessage({
      payload: {
        title: 'route test blocked',
        routing: { destination: ['emperor'] },
      },
    }))
    expect(blocked.status).toBe(201)
    const blockedId = (await blocked.json() as { id: string }).id
    const blockedState = await readState(app, blockedId)
    expect(blockedState.state).toBe('rejected')
    expect(lastReason(blockedState.transitions)).toBe('routing-destination-disallowed')

    const edict2 = `edict-routing-2-${randomUUID()}`
    const e2 = await submit(
      app,
      makeEdict(
        edict2,
        'routing',
        {
          table: { petition: ['emperor'] },
          broadcast_policy: 'hierarchical',
        },
        2,
        new Date().toISOString(),
        edict1,
      ),
    )
    expect(e2.status).toBe(201)

    const law = repo.getCurrentLaw('routing', new Date().toISOString())
    expect(law?.messageId).toBe(edict2)
    expect(((law?.content as { table?: Record<string, string[]> }).table ?? {}).petition).toEqual(['emperor'])
    expect((repo.getMessage(edict2)?.payload as { superseded_edict_id?: string }).superseded_edict_id).toBe(edict1)

    const allowed = await submit(app, petitionMessage({
      payload: {
        title: 'route test allowed',
        routing: { destination: ['emperor'] },
      },
    }))
    expect(allowed.status).toBe(201)
    const allowedId = (await allowed.json() as { id: string }).id
    expect((await readState(app, allowedId)).state).toBe('archived')

    repo.close()
  })
})

describe('Ritual 6: Cold Start Verification (Constitution from Empty)', () => {
  it('fails closed before constitutional sync, then resolves identical law after sync', async () => {
    const nodeA = createRepo('ritual3-cold-a')
    seedGenesisConstitution(nodeA.repo)
    seedGenreDefinition(nodeA.repo, 'petition')

    const bootlessB = createRepo('ritual3-cold-b-empty')
    const bootlessApp = buildGateway(bootlessB.repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })
    const preSync = await submit(bootlessApp, petitionMessage({ id: `bootless-${randomUUID()}` }))
    expect(preSync.status).toBe(503)
    expect((await preSync.json() as { error: string }).error).toBe('Schema Undefined')
    bootlessB.repo.close()

    nodeA.repo.close()

    const nodeBFile = tempDbPath('ritual3-cold-b')
    copyFileSync(nodeA.file, nodeBFile)

    const nodeARead = new SqliteArchiveRepository(nodeA.file)
    nodeARead.initialize()
    nodeARead.migrate()
    const nodeB = new SqliteArchiveRepository(nodeBFile)
    nodeB.initialize()
    nodeB.migrate()

    const at = new Date().toISOString()
    const lawSetA = nodeARead.getLawSet(at)
    const lawSetB = nodeB.getLawSet(at)
    const idsA = Object.fromEntries(Object.entries(lawSetA).map(([k, v]) => [k, v?.messageId ?? null]))
    const idsB = Object.fromEntries(Object.entries(lawSetB).map(([k, v]) => [k, v?.messageId ?? null]))
    expect(idsB).toEqual(idsA)

    const nodeBApp = buildGateway(nodeB, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })
    const postSync = await submit(nodeBApp, petitionMessage({ id: `synced-${randomUUID()}` }))
    expect(postSync.status).toBe(201)
    const postSyncId = (await postSync.json() as { id: string }).id
    expect((await readState(nodeBApp, postSyncId)).state).toBe('archived')

    nodeARead.close()
    nodeB.close()
  })
})

describe('Ritual 7: Invalid Cross-Reference', () => {
  it('rejects malformed edict law_type at Tongzheng Si boundary', async () => {
    const { repo } = createRepo('ritual3-invalid-xref')
    seedGenesisConstitution(repo)
    const app = buildGateway(repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })

    const badId = `edict-invalid-${randomUUID()}`
    const res = await submit(app, {
      id: badId,
      genre: 'edict',
      payload: {
        law_type: 'undefined_law_type',
        version: '1.0.0',
        content: {},
        precedence: 0,
        effective_date: new Date().toISOString(),
      },
      actor: { id: 'rogue', role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: {},
    })

    expect(res.status).toBe(400)
    expect((await res.json() as { error: string }).error).toBe('invalid-payload')
    expect(repo.getMessage(badId)).toBeUndefined()
    expect(repo.snapshotState(badId)).toBeUndefined()

    repo.close()
  })
})

describe('Ritual 8: Protocol Edict (Meta-Governance)', () => {
  it('applies new quorum to subsequent submissions', async () => {
    const { repo } = createRepo('ritual3-protocol')
    seedGenesisConstitution(repo)
    seedGenreDefinition(repo, 'dispatch')
    const app = buildGateway(repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })

    const protocolId = `edict-protocol-${randomUUID()}`
    const lawRes = await submit(
      app,
      makeEdict(protocolId, 'protocol', {
        required_acks_by_genre: { dispatch: 2 },
      }, 1),
    )
    expect(lawRes.status).toBe(201)

    const dispatchRes = await submit(
      app,
      envelope({
        id: `dispatch-${randomUUID()}`,
        genre: 'dispatch',
        payload: {
          text: 'wartime courier',
          routing: { destination: ['office_a', 'office_b', 'office_c'] },
        },
        actor: { id: 'war-ministry', role: 'admin' },
      }),
    )
    expect(dispatchRes.status).toBe(201)
    const dispatchId = (await dispatchRes.json() as { id: string }).id
    const pendingState = await readState(app, dispatchId)
    expect(pendingState.state).toBe('pending')

    const firstAck = await app.request(`/messages/${dispatchId}/approvals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ office: 'office_a' }),
    })
    expect(firstAck.status).toBe(200)
    const firstAckBody = await firstAck.json() as { state: string; required: number }
    expect(firstAckBody.state).toBe('pending')
    expect(firstAckBody.required).toBe(2)

    const secondAck = await app.request(`/messages/${dispatchId}/approvals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ office: 'office_b' }),
    })
    expect(secondAck.status).toBe(200)
    const secondAckBody = await secondAck.json() as { state: string; required: number }
    expect(secondAckBody.state).toBe('archived')
    expect(secondAckBody.required).toBe(2)

    repo.close()
  })

  it('fails closed in strict mode when protocol law content is invalid', async () => {
    const { repo } = createRepo('ritual3-protocol-invalid')
    seedGenesisConstitution(repo)
    seedGenreDefinition(repo, 'dispatch')
    const app = buildGateway(repo, new ReliableChannel(), IMPERIAL_CONTEXT, { lawMode: 'strict' })

    const invalidProtocol = await submit(
      app,
      makeEdict(`edict-protocol-invalid-${randomUUID()}`, 'protocol', {
        required_acks_by_genre: { dispatch: 0 },
      }, 2),
    )
    expect(invalidProtocol.status).toBe(201)

    const dispatchRes = await submit(
      app,
      envelope({
        id: `dispatch-invalid-${randomUUID()}`,
        genre: 'dispatch',
        payload: {
          text: 'invalid protocol should fail closed',
          routing: { destination: ['office_a', 'office_b'] },
        },
        actor: { id: 'war-ministry', role: 'admin' },
      }),
    )
    expect(dispatchRes.status).toBe(201)
    const dispatchId = (await dispatchRes.json() as { id: string }).id
    const state = await readState(app, dispatchId)
    expect(state.state).toBe('rejected')
    expect(lastReason(state.transitions)).toBe('protocol-law-invalid')

    repo.close()
  })
})
