import { allowedGenresForRole, canAuthorize, canReview } from '@wenyan/actor'
import type { ArchiveRepository } from '@wenyan/archive'
import {
  AppointmentLawContentSchema,
  ClassificationLawContentSchema,
  EdictLawTypeValues,
  ProtocolLawContentSchema,
  RoutingLawContentSchema,
  validateTiDefinition,
  type AppointmentLawContent,
  type EdictLawType,
  type LawMode,
  type MessageEnvelope,
  type Transition,
} from '@wenyan/core'
import { DEV_SEAL_CONTEXT, createSealChain, verifySealChain, type SealContext } from '@wenyan/seal'
import { LawResolver, type LawResolverEvent, type LawResolverOptions } from './law-resolver'
import { loadLawContent } from './law-access'

export * from './law-resolver'
export * from './law-access'

export class SealInvalidError extends Error {
  constructor(message = 'invalid-seal-chain') {
    super(message)
    this.name = 'SealInvalidError'
  }
}

export interface PipelineResult {
  messageId: string
  finalState: 'pending' | 'authorized' | 'rejected' | 'archived'
  reason?: string
}

export interface PipelineRuntimeOptions {
  lawResolver?: LawResolver
  lawMode?: LawMode
  lawCacheTtlSeconds?: number
  lawPreloadTypes?: EdictLawType[]
  onLawEvent?: (event: LawResolverEvent) => void
}

function transition(
  message: MessageEnvelope,
  fromState: Transition['fromState'],
  toState: Transition['toState'],
  sequenceNo: number,
  reason?: string,
): Transition {
  return {
    messageId: message.id,
    fromState,
    toState,
    sequenceNo,
    actorId: message.actor.id,
    sealedAt: new Date().toISOString(),
    reason,
    at: new Date().toISOString(),
  }
}

function destinationList(message: MessageEnvelope): string[] {
  const raw = (message.payload as Record<string, unknown>).routing as Record<string, unknown> | undefined
  const dest = raw?.destination
  if (Array.isArray(dest)) return dest.map((v) => String(v))
  if (typeof dest === 'string') return [dest]
  return []
}

function destinationCount(message: MessageEnvelope): number {
  const count = destinationList(message).length
  return count === 0 ? 1 : count
}

function extractClearance(message: MessageEnvelope): string | undefined {
  const metadata = message.metadata as Record<string, unknown>
  if (typeof metadata.clearance === 'string') return metadata.clearance
  const routing = (message.payload as Record<string, unknown>).routing as Record<string, unknown> | undefined
  if (typeof routing?.clearance === 'string') return routing.clearance
  return undefined
}

function parseRoutingObject(message: MessageEnvelope): Record<string, unknown> {
  const payload = message.payload as Record<string, unknown>
  const routing = payload.routing
  if (routing && typeof routing === 'object' && !Array.isArray(routing)) {
    return { ...(routing as Record<string, unknown>) }
  }
  return {}
}

function withRouting(message: MessageEnvelope, routing: Record<string, unknown>): MessageEnvelope {
  return {
    ...message,
    payload: {
      ...(message.payload as Record<string, unknown>),
      routing,
    },
  }
}

function resolverFor(repo: ArchiveRepository, options: PipelineRuntimeOptions = {}): LawResolver {
  if (options.lawResolver) return options.lawResolver

  const resolverOptions: LawResolverOptions = {
    mode: options.lawMode ?? 'compat',
    cacheTtlSeconds: options.lawCacheTtlSeconds ?? 60,
    preloadTypes: options.lawPreloadTypes,
    onEvent: options.onLawEvent,
  }
  return new LawResolver(repo, resolverOptions)
}

function maybeInvalidateLawFromMessage(resolver: LawResolver, message: MessageEnvelope): void {
  if (message.genre !== 'edict') return
  const payload = message.payload as Record<string, unknown>
  const rawLawType = payload.law_type
  if (typeof rawLawType === 'string' && EdictLawTypeValues.includes(rawLawType as EdictLawType)) {
    resolver.invalidate(rawLawType as EdictLawType)
    return
  }
  resolver.invalidate()
}

async function appendNextTransition(
  repo: ArchiveRepository,
  message: MessageEnvelope,
  fromState: Transition['fromState'],
  toState: Transition['toState'],
  reason?: string,
): Promise<void> {
  const sequenceNo = (await repo.getTransitions(message.id)).length + 1
  await repo.appendTransition(transition(message, fromState, toState, sequenceNo, reason))
}

export function caoni(message: MessageEnvelope): MessageEnvelope {
  return {
    ...message,
    payload: Object.fromEntries(Object.entries(message.payload).map(([k, v]) => [k.trim(), v])),
  }
}

export function shenfu(message: MessageEnvelope): { ok: true } | { ok: false; reason: string } {
  if (Object.keys(message.payload).length === 0) {
    return { ok: false, reason: 'empty-payload' }
  }
  return { ok: true }
}

async function shenfuSchema(
  message: MessageEnvelope,
  repo: ArchiveRepository,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (message.genre === 'ti_definition') {
    try {
      validateTiDefinition(message)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'invalid-ti-definition' }
    }
  }
  const schema = await repo.getActiveGenreSchema(message.genre)
  if (!schema) return { ok: true }

  const required = Array.isArray(schema.required) ? schema.required : []
  for (const key of required) {
    if (typeof key === 'string' && !(key in message.payload)) {
      return { ok: false, reason: 'schema-noncompliant' }
    }
  }
  return { ok: true }
}

function appointmentAllowsGenre(
  message: MessageEnvelope,
  appointmentLaw: AppointmentLawContent | undefined,
): boolean {
  if (!appointmentLaw) return true
  const allowed = allowedGenresForRole(message.actor.role, appointmentLaw)
  return allowed.includes('*') || allowed.includes(message.genre)
}

async function applyRoutingLaw(
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true; message: MessageEnvelope } | { ok: false; reason: string }> {
  const law = await loadLawContent({
    resolver,
    lawType: 'routing',
    schema: RoutingLawContentSchema,
    strictErrors: {
      missing: 'routing-law-missing-routing',
      ambiguous: 'routing-law-ambiguous-routing',
      invalid: 'routing-law-invalid',
    },
  })
  if (!law.ok) return { ok: false, reason: law.error }
  if (!law.content) return { ok: true, message }

  const table = law.content.table
  const expected = table[message.genre]
  if (!expected || expected.length === 0) return { ok: true, message }

  const routing = parseRoutingObject(message)
  const existingDest = destinationList(message)
  if (existingDest.length === 0) {
    routing.destination = expected
    return { ok: true, message: withRouting(message, routing) }
  }

  const disallowed = existingDest.filter((d) => !expected.includes(d))
  if (disallowed.length > 0) {
    return { ok: false, reason: 'routing-destination-disallowed' }
  }

  return { ok: true, message }
}

async function reviewByLaw(
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const law = await loadLawContent({
    resolver,
    lawType: 'appointment',
    schema: AppointmentLawContentSchema,
    strictErrors: {
      missing: 'appointment-law-missing-appointment',
      ambiguous: 'appointment-law-ambiguous-appointment',
      invalid: 'appointment-law-invalid',
    },
  })
  if (!law.ok) return { ok: false, reason: law.error }

  if (law.content) {
    if (!canReview(message.actor.role, law.content)) {
      return { ok: false, reason: 'actor-cannot-review' }
    }
    if (!appointmentAllowsGenre(message, law.content)) {
      return { ok: false, reason: 'genre-not-allowed-for-role' }
    }
    return { ok: true }
  }

  if (!canReview(message.actor.role)) {
    return { ok: false, reason: 'actor-cannot-review' }
  }
  return { ok: true }
}

async function authorizeByLaw(
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const law = await loadLawContent({
    resolver,
    lawType: 'appointment',
    schema: AppointmentLawContentSchema,
    strictErrors: {
      missing: 'appointment-law-missing-appointment',
      ambiguous: 'appointment-law-ambiguous-appointment',
      invalid: 'appointment-law-invalid',
    },
  })
  if (!law.ok) return { ok: false, reason: law.error }

  if (law.content) {
    if (!canAuthorize(message.actor.role, law.content)) {
      return { ok: false, reason: 'actor-cannot-authorize' }
    }
    return { ok: true }
  }

  if (!canAuthorize(message.actor.role)) {
    return { ok: false, reason: 'actor-cannot-authorize' }
  }
  return { ok: true }
}

async function classificationCheck(
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const law = await loadLawContent({
    resolver,
    lawType: 'classification',
    schema: ClassificationLawContentSchema,
    strictErrors: {
      missing: 'classification-law-missing-classification',
      ambiguous: 'classification-law-ambiguous-classification',
      invalid: 'classification-law-invalid',
    },
  })
  if (!law.ok) return { ok: false, reason: law.error }
  if (!law.content) return { ok: true }

  const clearance = extractClearance(message)
  if (!clearance) return { ok: true }
  if (!law.content.levels.includes(clearance)) {
    return { ok: false, reason: 'classification-clearance-invalid' }
  }
  return { ok: true }
}

async function requiredAcksByLaw(
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true; required: number } | { ok: false; reason: string }> {
  const law = await loadLawContent({
    resolver,
    lawType: 'protocol',
    schema: ProtocolLawContentSchema,
    strictErrors: {
      missing: 'protocol-law-missing-protocol',
      ambiguous: 'protocol-law-ambiguous-protocol',
      invalid: 'protocol-law-invalid',
    },
  })
  if (!law.ok) return { ok: false, reason: law.error }
  if (!law.content) return { ok: true, required: destinationCount(message) }
  return { ok: true, required: law.content.required_acks_by_genre[message.genre] ?? destinationCount(message) }
}

async function applySealsAndArchive(
  repo: ArchiveRepository,
  message: MessageEnvelope,
  sealContext: SealContext,
): Promise<PipelineResult> {
  const seals = await createSealChain(message, sealContext)
  const valid = await verifySealChain(message, seals, sealContext)
  if (!valid) {
    throw new SealInvalidError()
  }

  for (const s of seals) {
    await repo.appendSeal(s)
  }

  const current = (await repo.snapshotState(message.id)) ?? 'pending'
  await appendNextTransition(repo, message, current, 'authorized')
  await appendNextTransition(repo, message, 'authorized', 'archived')

  return { messageId: message.id, finalState: 'archived' }
}

export async function finalizePendingMessage(
  repo: ArchiveRepository,
  messageId: string,
  sealContext: SealContext = DEV_SEAL_CONTEXT,
  options: PipelineRuntimeOptions = {},
): Promise<PipelineResult> {
  const resolver = resolverFor(repo, options)
  const message = await repo.getMessage(messageId)
  if (!message) throw new Error(`Message not found: ${messageId}`)

  const requiredAcks = await requiredAcksByLaw(resolver, message)
  if (!requiredAcks.ok) {
    return { messageId, finalState: 'rejected', reason: requiredAcks.reason }
  }
  if (requiredAcks.required > 1) {
    const approvals = await repo.getOfficeApprovals(messageId)
    if (approvals.length < requiredAcks.required) {
      return { messageId, finalState: 'pending', reason: 'awaiting-protocol-acks' }
    }
  }

  const result = await applySealsAndArchive(repo, message, sealContext)
  maybeInvalidateLawFromMessage(resolver, message)
  return result
}

export async function processDocketMessage(
  repo: ArchiveRepository,
  messageId: string,
  sealContext: SealContext = DEV_SEAL_CONTEXT,
  options: PipelineRuntimeOptions = {},
): Promise<PipelineResult> {
  const resolver = resolverFor(repo, options)
  const message = await repo.getMessage(messageId)
  if (!message) {
    throw new Error(`Message not found: ${messageId}`)
  }

  const normalized = caoni(message)
  const routed = await applyRoutingLaw(resolver, normalized)
  if (!routed.ok) {
    await appendNextTransition(repo, normalized, 'pending', 'rejected', routed.reason)
    return { messageId, finalState: 'rejected', reason: routed.reason }
  }

  const materialized = routed.message
  await appendNextTransition(repo, materialized, 'pending', 'validated')

  const review = shenfu(materialized)
  if (!review.ok) {
    await appendNextTransition(repo, materialized, 'validated', 'rejected', review.reason)
    return { messageId, finalState: 'rejected', reason: review.reason }
  }

  const schemaReview = await shenfuSchema(materialized, repo)
  if (!schemaReview.ok) {
    await appendNextTransition(repo, materialized, 'validated', 'rejected', schemaReview.reason)
    return { messageId, finalState: 'rejected', reason: schemaReview.reason }
  }

  const lawReview = await reviewByLaw(resolver, materialized)
  if (!lawReview.ok) {
    await appendNextTransition(repo, materialized, 'validated', 'rejected', lawReview.reason)
    return { messageId, finalState: 'rejected', reason: lawReview.reason }
  }

  const classification = await classificationCheck(resolver, materialized)
  if (!classification.ok) {
    await appendNextTransition(repo, materialized, 'validated', 'rejected', classification.reason)
    return { messageId, finalState: 'rejected', reason: classification.reason }
  }

  await appendNextTransition(repo, materialized, 'validated', 'reviewed')

  const auth = await authorizeByLaw(resolver, materialized)
  if (!auth.ok) {
    await appendNextTransition(repo, materialized, 'reviewed', 'rejected', auth.reason)
    return { messageId, finalState: 'rejected', reason: auth.reason }
  }

  const requiredAcks = await requiredAcksByLaw(resolver, materialized)
  if (!requiredAcks.ok) {
    await appendNextTransition(repo, materialized, 'reviewed', 'rejected', requiredAcks.reason)
    return { messageId, finalState: 'rejected', reason: requiredAcks.reason }
  }

  if (requiredAcks.required > 1) {
    const approvals = await repo.getOfficeApprovals(messageId)
    if (approvals.length < requiredAcks.required) {
      await appendNextTransition(repo, materialized, 'reviewed', 'pending', `awaiting-protocol-acks-${requiredAcks.required}`)
      return { messageId, finalState: 'pending' }
    }
  }

  const result = await applySealsAndArchive(repo, materialized, sealContext)
  maybeInvalidateLawFromMessage(resolver, materialized)
  return result
}
