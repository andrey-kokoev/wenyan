import { Hono } from 'hono'
import type { ArchiveRepository } from '@wenyan/archive'
import type { ReliableChannel } from '@wenyan/channel'
import {
  AdmissionLawContentSchema,
  ProtocolLawContentSchema,
  validateEdict,
  validateEnvelope,
  validateTiDefinition,
  type EdictLawType,
  type LawMode,
} from '@wenyan/core'
import { DEV_SEAL_CONTEXT, type SealContext } from '@wenyan/seal'
import {
  LawResolver,
  SealInvalidError,
  finalizePendingMessage,
  loadLawContent,
  processDocketMessage,
  type LawResolverEvent,
} from '@wenyan/pipeline'

function isZodLikeError(error: unknown): error is { issues: unknown[] } {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'issues' in error &&
      Array.isArray((error as { issues?: unknown[] }).issues),
  )
}

function requiredOffices(message: { payload: Record<string, unknown> }): string[] {
  const routing = message.payload.routing as { destination?: unknown } | undefined
  if (Array.isArray(routing?.destination)) return routing.destination.map(String)
  if (typeof routing?.destination === 'string') return [routing.destination]
  return []
}

export interface GatewayRuntimeOptions {
  lawMode?: LawMode
  lawCacheTtlSeconds?: number
  lawPreloadTypes?: EdictLawType[]
  onLawEvent?: (event: LawResolverEvent) => void
  lawResolver?: LawResolver
}

async function validateByArchivedTi(
  repo: ArchiveRepository,
  message: ReturnType<typeof validateEnvelope>,
  options: { requireDefinedGenreSchema?: boolean } = {},
) {
  if (message.genre === 'ti_definition') {
    validateTiDefinition(message)
    return
  }
  if (message.genre === 'edict') {
    validateEdict(message)
    return
  }

  const schema = await repo.getActiveGenreSchema(message.genre)
  if (!schema) {
    if (options.requireDefinedGenreSchema) {
      throw new Error('genre-schema-missing')
    }
    return
  }
  const required = Array.isArray(schema.required) ? schema.required : []
  for (const key of required) {
    if (typeof key === 'string' && !(key in message.payload)) {
      throw new Error('schema-noncompliant')
    }
  }
}

async function admissionCheck(
  resolver: LawResolver,
  message: ReturnType<typeof validateEnvelope>,
): Promise<void> {
  if (message.genre === 'ti_definition' || message.genre === 'edict') {
    return
  }

  const law = await loadLawContent({
    resolver,
    lawType: 'admission',
    schema: AdmissionLawContentSchema,
    strictErrors: {
      missing: 'law-missing-admission',
      ambiguous: 'law-ambiguous-admission',
      invalid: 'law-invalid-admission',
    },
  })
  if (!law.ok) {
    throw new Error(law.error)
  }
  if (!law.content) return

  const allowed = law.content.allowed_genres
  if (!allowed.includes('*') && !allowed.includes(message.genre)) {
    throw new Error('genre-not-admitted')
  }
}

async function protocolRequiredAcks(resolver: LawResolver, message: { genre: string; payload: Record<string, unknown> }): Promise<number> {
  const base = requiredOffices(message).length || 1
  const law = await loadLawContent({
    resolver,
    lawType: 'protocol',
    schema: ProtocolLawContentSchema,
    strictErrors: {
      missing: 'law-missing-protocol',
      ambiguous: 'law-ambiguous-protocol',
      invalid: 'law-invalid-protocol',
    },
  })
  if (!law.ok) {
    throw new Error(law.error)
  }
  if (!law.content) return base
  return law.content.required_acks_by_genre[message.genre] ?? base
}

export async function tongzhengSi(
  repo: ArchiveRepository,
  resolver: LawResolver,
  input: unknown,
) {
  const message = validateEnvelope(input)
  await validateByArchivedTi(repo, message, {
    requireDefinedGenreSchema: resolver.getMode() === 'strict',
  })
  await admissionCheck(resolver, message)
  return message
}

type RepoFactory = ArchiveRepository | (() => ArchiveRepository | Promise<ArchiveRepository>)

async function resolveRepo(repoFactory: RepoFactory): Promise<ArchiveRepository> {
  if (typeof repoFactory === 'function') return repoFactory()
  return repoFactory
}

export function buildGateway(
  repoFactory: RepoFactory,
  channel: ReliableChannel,
  sealContext: SealContext = DEV_SEAL_CONTEXT,
  options: GatewayRuntimeOptions = {},
) {
  const app = new Hono()
  let runtimeRepo: ArchiveRepository | undefined
  let runtimeResolver: LawResolver | undefined = options.lawResolver

  async function resolveRuntime(): Promise<{ repo: ArchiveRepository; resolver: LawResolver }> {
    const repo = await resolveRepo(repoFactory)
    if (!runtimeResolver || runtimeRepo !== repo) {
      runtimeResolver =
        options.lawResolver ??
        new LawResolver(repo, {
          mode: options.lawMode ?? 'compat',
          cacheTtlSeconds: options.lawCacheTtlSeconds ?? 60,
          preloadTypes: options.lawPreloadTypes,
          onEvent: options.onLawEvent,
        })
      runtimeRepo = repo
      await runtimeResolver.preload()
    }
    return { repo, resolver: runtimeResolver }
  }

  app.post('/messages', async (c) => {
    try {
      const nowIso = new Date().toISOString()
      const idempotencyKey = c.req.header('x-idempotency-key')
      const { repo, resolver } = await resolveRuntime()
      if (idempotencyKey) {
        const existing = await repo.getIdempotency(idempotencyKey, nowIso)
        if (existing) {
          return c.json(JSON.parse(existing.responseJson), 200)
        }
      }

      const body = await c.req.json()
      const message = await tongzhengSi(repo, resolver, body)

      await repo.appendMessage(message)
      await repo.enqueueDocket(message.id)

      const item = await repo.dequeueDocket(new Date().toISOString())
      if (item) {
        const result = await processDocketMessage(repo, item.messageId, sealContext, {
          lawResolver: resolver,
          lawMode: options.lawMode ?? 'compat',
          lawCacheTtlSeconds: options.lawCacheTtlSeconds ?? 60,
          lawPreloadTypes: options.lawPreloadTypes,
          onLawEvent: options.onLawEvent,
        })
        const transitions = await repo.getTransitions(item.messageId)
        const last = transitions[transitions.length - 1]
        channel.publish({
          id: `${item.messageId}:${last.sequenceNo}`,
          type: result.finalState === 'rejected' ? 'message.rejected' : 'archive.appended',
          messageId: item.messageId,
          payload: { result },
          at: new Date().toISOString(),
        })
      }

      const response = { id: message.id, acceptedAt: nowIso }
      if (idempotencyKey) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        await repo.putIdempotency(idempotencyKey, JSON.stringify(response), expiresAt)
      }

      c.header('location', `/api/wenyan/messages/${message.id}`)
      return c.json(response, 201)
    } catch (error) {
      if (isZodLikeError(error)) {
        return c.json({ error: 'invalid-payload', issues: error.issues }, 400)
      }
      if (error instanceof Error && error.message === 'schema-noncompliant') {
        return c.json({ error: 'schema-noncompliant' }, 400)
      }
      if (error instanceof Error && error.message === 'genre-schema-missing') {
        return c.json({ error: 'genre-schema-missing' }, 503)
      }
      if (error instanceof Error && error.message === 'genre-not-admitted') {
        return c.json({ error: 'genre-not-admitted' }, 403)
      }
      if (error instanceof Error && error.message.startsWith('law-')) {
        return c.json({ error: error.message }, 503)
      }
      if (error instanceof SealInvalidError) {
        return c.json({ error: 'invalid-seal-chain' }, 403)
      }
      return c.json({ error: 'internal-error' }, 500)
    }
  })

  app.post('/messages/:id/approvals', async (c) => {
    const { repo, resolver } = await resolveRuntime()
    const id = c.req.param('id')
    const message = await repo.getMessage(id)
    if (!message) return c.json({ error: 'not-found' }, 404)

    const body = (await c.req.json()) as { office?: string }
    const office = body.office
    if (!office) return c.json({ error: 'office-required' }, 400)

    const requiredOfficesList = requiredOffices(message)
    if (!requiredOfficesList.includes(office)) {
      return c.json({ error: 'office-not-required' }, 400)
    }

    await repo.addOfficeApproval(id, office)
    const approvals = await repo.getOfficeApprovals(id)

    const requiredCount = await protocolRequiredAcks(resolver, message)
    if (approvals.length < requiredCount) {
      return c.json({ state: 'pending', approvals, required: requiredCount }, 200)
    }

    try {
      const result = await finalizePendingMessage(repo, id, sealContext, {
        lawResolver: resolver,
        lawMode: options.lawMode ?? 'compat',
        lawCacheTtlSeconds: options.lawCacheTtlSeconds ?? 60,
        lawPreloadTypes: options.lawPreloadTypes,
        onLawEvent: options.onLawEvent,
      })
      return c.json({ state: result.finalState, approvals, required: requiredCount }, 200)
    } catch (error) {
      if (error instanceof SealInvalidError) {
        return c.json({ error: 'invalid-seal-chain' }, 403)
      }
      if (error instanceof Error && error.message.startsWith('law-')) {
        return c.json({ error: error.message }, 503)
      }
      return c.json({ error: 'internal-error' }, 500)
    }
  })

  app.get('/messages/:id', (c) => {
    const runtimePromise = resolveRuntime()
    return (async () => {
      const id = c.req.param('id')
      const { repo } = await runtimePromise
      const message = await repo.getMessage(id)
      if (!message) {
        return c.json({ error: 'not-found' }, 404)
      }
      return c.json({
        message,
        state: (await repo.snapshotState(id)) ?? 'pending',
        transitions: await repo.getTransitions(id),
        seals: await repo.getSeals(id),
        approvals: await repo.getOfficeApprovals(id),
      })
    })()
  })

  app.get('/messages', (c) => {
    const state = c.req.query('state')
    if (!state) {
      return c.json({ error: 'state-query-required' }, 400)
    }
    return c.json({ state, items: [] })
  })

  app.get('/stream', (c) => {
    const since = c.req.query('since') ?? new Date(Date.now() - 60_000).toISOString()
    return c.json({ events: channel.replay(since) })
  })

  return app
}
