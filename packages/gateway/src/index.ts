import { Hono } from 'hono'
import type { ArchiveRepository } from '@wenyan/archive'
import type { ReliableChannel } from '@wenyan/channel'
import { validateEnvelope } from '@wenyan/core'
import { DEV_SEAL_CONTEXT, type SealContext } from '@wenyan/seal'
import { SealInvalidError, finalizePendingMessage, processDocketMessage } from '@wenyan/pipeline'

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

export function tongzhengSi (input: unknown) {
  return validateEnvelope(input)
}

type RepoFactory = ArchiveRepository | (() => ArchiveRepository | Promise<ArchiveRepository>)

async function resolveRepo(repoFactory: RepoFactory): Promise<ArchiveRepository> {
  if (typeof repoFactory === 'function') return repoFactory()
  return repoFactory
}

export function buildGateway(repoFactory: RepoFactory, channel: ReliableChannel, sealContext: SealContext = DEV_SEAL_CONTEXT) {
  const app = new Hono()

  app.post('/messages', async (c) => {
    try {
      const nowIso = new Date().toISOString()
      const idempotencyKey = c.req.header('x-idempotency-key')
      const repo = await resolveRepo(repoFactory)
      if (idempotencyKey) {
        const existing = await repo.getIdempotency(idempotencyKey, nowIso)
        if (existing) {
          return c.json(JSON.parse(existing.responseJson), 200)
        }
      }

      const body = await c.req.json()
      const message = tongzhengSi(body)

      await repo.appendMessage(message)
      await repo.enqueueDocket(message.id)

      const item = await repo.dequeueDocket(new Date().toISOString())
      if (item) {
        const result = await processDocketMessage(repo, item.messageId, sealContext)
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
      if (error instanceof SealInvalidError) {
        return c.json({ error: 'invalid-seal-chain' }, 403)
      }
      return c.json({ error: 'internal-error' }, 500)
    }
  })

  app.post('/messages/:id/approvals', async (c) => {
    const repo = await resolveRepo(repoFactory)
    const id = c.req.param('id')
    const message = await repo.getMessage(id)
    if (!message) return c.json({ error: 'not-found' }, 404)

    const body = (await c.req.json()) as { office?: string }
    const office = body.office
    if (!office) return c.json({ error: 'office-required' }, 400)

    const required = requiredOffices(message)
    if (!required.includes(office)) {
      return c.json({ error: 'office-not-required' }, 400)
    }

    await repo.addOfficeApproval(id, office)
    const approvals = await repo.getOfficeApprovals(id)

    if (approvals.length < required.length) {
      return c.json({ state: 'pending', approvals, required }, 200)
    }

    try {
      const result = await finalizePendingMessage(repo, id, sealContext)
      return c.json({ state: result.finalState, approvals, required }, 200)
    } catch (error) {
      if (error instanceof SealInvalidError) {
        return c.json({ error: 'invalid-seal-chain' }, 403)
      }
      return c.json({ error: 'internal-error' }, 500)
    }
  })

  app.get('/messages/:id', (c) => {
    const repoPromise = resolveRepo(repoFactory)
    return (async () => {
    const id = c.req.param('id')
    const repo = await repoPromise
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
