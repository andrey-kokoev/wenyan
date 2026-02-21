import { allowedGenresForRole, canAuthorize, canReview } from '@andrey-kokoev/wenyan-actor'
import type { ArchiveRepository } from '@andrey-kokoev/wenyan-archive'
import { canAuthorizeGenre, canDraftGenre, canReviewGenre, isImperialWorksGenre } from '@andrey-kokoev/wenyan-imperial-works'
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
} from '@andrey-kokoev/wenyan-core'
import { InsufficientImperialAuthorityError, createSealChain, verifySealChain, type SealContext } from '@andrey-kokoev/wenyan-seal'
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
  distributedMode?: 'single' | 'consort'
  consensusKind?: 'none' | 'pbft'
  pbftConsensus?: {
    proposeTiDefinition (proposalId: string, leaderNodeId: string): Promise<unknown> | unknown
    onPrepare (msg: { proposalId: string; viewNo: number; nodeId: string; phase: 'prepare'; signature: string; at: string }): Promise<boolean> | boolean
    onCommit (msg: { proposalId: string; viewNo: number; nodeId: string; phase: 'commit'; signature: string; at: string }): Promise<boolean> | boolean
    commitIfThreshold (proposalId: string): boolean
    currentView (): number
  }
  nodeId?: string
  lawCacheTtlSeconds?: number
  lawPreloadTypes?: EdictLawType[]
  onLawEvent?: (event: LawResolverEvent) => void
}

function transition (
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

function destinationList (message: MessageEnvelope): string[] {
  const raw = (message.payload as Record<string, unknown>).routing as Record<string, unknown> | undefined
  const dest = raw?.destination
  if (Array.isArray(dest)) return dest.map((v) => String(v))
  if (typeof dest === 'string') return [dest]
  return []
}

function destinationCount (message: MessageEnvelope): number {
  const count = destinationList(message).length
  return count === 0 ? 1 : count
}

function extractClearance (message: MessageEnvelope): string | undefined {
  const metadata = message.metadata as Record<string, unknown>
  if (typeof metadata.clearance === 'string') return metadata.clearance
  const routing = (message.payload as Record<string, unknown>).routing as Record<string, unknown> | undefined
  if (typeof routing?.clearance === 'string') return routing.clearance
  return undefined
}

function parseRoutingObject (message: MessageEnvelope): Record<string, unknown> {
  const payload = message.payload as Record<string, unknown>
  const routing = payload.routing
  if (routing && typeof routing === 'object' && !Array.isArray(routing)) {
    return { ...(routing as Record<string, unknown>) }
  }
  return {}
}

function withRouting (message: MessageEnvelope, routing: Record<string, unknown>): MessageEnvelope {
  return {
    ...message,
    payload: {
      ...(message.payload as Record<string, unknown>),
      routing,
    },
  }
}

function withLawSnapshot (message: MessageEnvelope, atIso: string): MessageEnvelope {
  return {
    ...message,
    metadata: {
      ...(message.metadata as Record<string, unknown>),
      law_snapshot: {
        at: atIso,
      },
    },
  }
}

function lawSnapshotAt (message: MessageEnvelope): string {
  const metadata = message.metadata as Record<string, unknown>
  const raw = metadata.law_snapshot
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const at = (raw as { at?: unknown }).at
    if (typeof at === 'string' && at.length > 0) return at
  }
  return message.submittedAt
}

function resolverFor (repo: ArchiveRepository, options: PipelineRuntimeOptions = {}): LawResolver {
  if (options.lawResolver) return options.lawResolver

  const resolverOptions: LawResolverOptions = {
    mode: options.lawMode ?? 'strict',
    cacheTtlSeconds: options.lawCacheTtlSeconds ?? 60,
    preloadTypes: options.lawPreloadTypes,
    onEvent: options.onLawEvent,
  }
  return new LawResolver(repo, resolverOptions)
}

function maybeInvalidateLawFromMessage (resolver: LawResolver, message: MessageEnvelope): void {
  if (message.genre !== 'edict') return
  const payload = message.payload as Record<string, unknown>
  const rawLawType = payload.law_type
  if (typeof rawLawType === 'string' && EdictLawTypeValues.includes(rawLawType as EdictLawType)) {
    resolver.invalidate(rawLawType as EdictLawType)
    return
  }
  resolver.invalidate()
}

async function appendNextTransition (
  repo: ArchiveRepository,
  message: MessageEnvelope,
  fromState: Transition['fromState'],
  toState: Transition['toState'],
  reason?: string,
): Promise<void> {
  const sequenceNo = (await repo.getTransitions(message.id)).length + 1
  await repo.appendTransition(transition(message, fromState, toState, sequenceNo, reason))
}

export function caoni (message: MessageEnvelope): MessageEnvelope {
  return {
    ...message,
    payload: Object.fromEntries(Object.entries(message.payload).map(([k, v]) => [k.trim(), v])),
  }
}

export function shenfu (message: MessageEnvelope): { ok: true } | { ok: false; reason: string } {
  if (Object.keys(message.payload).length === 0) {
    return { ok: false, reason: 'empty-payload' }
  }
  if (isImperialWorksGenre(message.genre) && !canDraftGenre(message.actor.role, message.genre)) {
    return { ok: false, reason: 'hierarchy_violation' }
  }
  return { ok: true }
}

async function shenfuSchema (
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
  if (message.genre === 'edict') {
    const payload = message.payload as Record<string, unknown>
    const targetGenre = payload.target_genre
    if (typeof targetGenre === 'string' && targetGenre.length > 0) {
      const targetTi = await repo.getCurrentTiDefinition(targetGenre, lawSnapshotAt(message))
      if (!targetTi) {
        return { ok: false, reason: 'invalid-constitutional-reference' }
      }
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

function appointmentAllowsGenre (
  message: MessageEnvelope,
  appointmentLaw: AppointmentLawContent,
): boolean {
  const allowed = allowedGenresForRole(message.actor.role, appointmentLaw)
  return allowed.includes('*') || allowed.includes(message.genre)
}

async function applyRoutingLaw (
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true; message: MessageEnvelope } | { ok: false; reason: string }> {
  const snapshotAt = lawSnapshotAt(message)
  const law = await loadLawContent({
    resolver,
    lawType: 'routing',
    atIso: snapshotAt,
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

async function reviewByLaw (
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const snapshotAt = lawSnapshotAt(message)
  const law = await loadLawContent({
    resolver,
    lawType: 'appointment',
    atIso: snapshotAt,
    schema: AppointmentLawContentSchema,
    strictErrors: {
      missing: 'appointment-law-missing-appointment',
      ambiguous: 'appointment-law-ambiguous-appointment',
      invalid: 'appointment-law-invalid',
    },
  })
  if (!law.ok) return { ok: false, reason: law.error }
  if (!law.content) return { ok: false, reason: 'appointment-law-missing-appointment' }

  const appointmentLaw = law.content
  if (!canReview(message.actor.role, appointmentLaw)) {
    return { ok: false, reason: 'actor-cannot-review' }
  }
  if (isImperialWorksGenre(message.genre) && !canReviewGenre(message.actor.role, message.genre)) {
    return { ok: false, reason: 'hierarchy_violation' }
  }
  if (!appointmentAllowsGenre(message, appointmentLaw)) {
    return { ok: false, reason: 'genre-not-allowed-for-role' }
  }
  return { ok: true }
}

async function authorizeByLaw (
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const snapshotAt = lawSnapshotAt(message)
  const law = await loadLawContent({
    resolver,
    lawType: 'appointment',
    atIso: snapshotAt,
    schema: AppointmentLawContentSchema,
    strictErrors: {
      missing: 'appointment-law-missing-appointment',
      ambiguous: 'appointment-law-ambiguous-appointment',
      invalid: 'appointment-law-invalid',
    },
  })
  if (!law.ok) return { ok: false, reason: law.error }
  if (!law.content) return { ok: false, reason: 'appointment-law-missing-appointment' }

  if (!canAuthorize(message.actor.role, law.content)) {
    return { ok: false, reason: 'actor-cannot-authorize' }
  }
  if (isImperialWorksGenre(message.genre) && !canAuthorizeGenre(message.actor.role, message.genre)) {
    return { ok: false, reason: 'hierarchy_violation' }
  }
  return { ok: true }
}

async function classificationCheck (
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const snapshotAt = lawSnapshotAt(message)
  const law = await loadLawContent({
    resolver,
    lawType: 'classification',
    atIso: snapshotAt,
    schema: ClassificationLawContentSchema,
    strictErrors: {
      missing: 'classification-law-missing-classification',
      ambiguous: 'classification-law-ambiguous-classification',
      invalid: 'classification-law-invalid',
    },
  })
  if (!law.ok) return { ok: false, reason: law.error }
  if (!law.content) return { ok: false, reason: 'classification-law-missing-classification' }

  const clearance = extractClearance(message)
  if (!clearance) return { ok: true }
  if (!law.content.levels.includes(clearance)) {
    return { ok: false, reason: 'classification-clearance-invalid' }
  }
  return { ok: true }
}

async function requiredAcksByLaw (
  resolver: LawResolver,
  message: MessageEnvelope,
): Promise<{ ok: true; required: number } | { ok: false; reason: string }> {
  const snapshotAt = lawSnapshotAt(message)
  const law = await loadLawContent({
    resolver,
    lawType: 'protocol',
    atIso: snapshotAt,
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

async function applySealsAndArchive (
  repo: ArchiveRepository,
  message: MessageEnvelope,
  sealContext: SealContext,
): Promise<PipelineResult> {
  const seals = await createSealChain(message, sealContext)
  let valid = false
  try {
    valid = await verifySealChain(message, seals, sealContext)
  } catch {
    valid = false
  }
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

function mapSealFailure (error: unknown): string | undefined {
  if (error instanceof InsufficientImperialAuthorityError) return 'insufficient-imperial-authority'
  if (error instanceof SealInvalidError) return 'invalid-seal-chain'
  return undefined
}

export async function finalizePendingMessage (
  repo: ArchiveRepository,
  messageId: string,
  sealContext: SealContext,
  options: PipelineRuntimeOptions = {},
): Promise<PipelineResult> {
  const resolver = resolverFor(repo, options)
  const message = await repo.getMessage(messageId)
  if (!message) throw new Error(`Message not found: ${messageId}`)
  const withSnapshot = withLawSnapshot(message, new Date().toISOString())

  const requiredAcks = await requiredAcksByLaw(resolver, withSnapshot)
  if (!requiredAcks.ok) {
    return { messageId, finalState: 'rejected', reason: requiredAcks.reason }
  }
  if (requiredAcks.required > 1) {
    const approvals = await repo.getOfficeApprovals(messageId)
    if (approvals.length < requiredAcks.required) {
      return { messageId, finalState: 'pending', reason: 'awaiting-protocol-acks' }
    }
  }

  if ((options.distributedMode ?? 'single') === 'consort' && (options.consensusKind ?? 'none') === 'pbft' && withSnapshot.genre === 'ti_definition') {
    const pbft = options.pbftConsensus
    if (!pbft) return { messageId, finalState: 'pending', reason: 'awaiting-pbft-consensus' }
    const nodeId = options.nodeId ?? 'local-node'
    try {
      await pbft.proposeTiDefinition(messageId, nodeId)
    } catch {
      return { messageId, finalState: 'pending', reason: 'awaiting-pbft-consensus' }
    }
    if (!pbft.commitIfThreshold(messageId)) {
      return { messageId, finalState: 'pending', reason: 'awaiting-pbft-consensus' }
    }
  }

  try {
    const result = await applySealsAndArchive(repo, withSnapshot, sealContext)
    maybeInvalidateLawFromMessage(resolver, withSnapshot)
    return result
  } catch (error) {
    const reason = mapSealFailure(error)
    if (!reason) throw error
    const current = (await repo.snapshotState(withSnapshot.id)) ?? 'pending'
    await appendNextTransition(repo, withSnapshot, current, 'rejected', reason)
    return { messageId, finalState: 'rejected', reason }
  }
}

export async function processDocketMessage (
  repo: ArchiveRepository,
  messageId: string,
  sealContext: SealContext,
  options: PipelineRuntimeOptions = {},
): Promise<PipelineResult> {
  const resolver = resolverFor(repo, options)
  const message = await repo.getMessage(messageId)
  if (!message) {
    throw new Error(`Message not found: ${messageId}`)
  }

  const normalized = withLawSnapshot(caoni(message), new Date().toISOString())
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

  if ((options.distributedMode ?? 'single') === 'consort' && (options.consensusKind ?? 'none') === 'pbft' && materialized.genre === 'ti_definition') {
    const pbft = options.pbftConsensus
    if (!pbft) {
      await appendNextTransition(repo, materialized, 'reviewed', 'pending', 'awaiting-pbft-consensus')
      return { messageId, finalState: 'pending', reason: 'awaiting-pbft-consensus' }
    }
    const nodeId = options.nodeId ?? 'local-node'
    try {
      await pbft.proposeTiDefinition(messageId, nodeId)
    } catch {
      await appendNextTransition(repo, materialized, 'reviewed', 'pending', 'awaiting-pbft-consensus')
      return { messageId, finalState: 'pending', reason: 'awaiting-pbft-consensus' }
    }
    if (!pbft.commitIfThreshold(messageId)) {
      await appendNextTransition(repo, materialized, 'reviewed', 'pending', 'awaiting-pbft-consensus')
      return { messageId, finalState: 'pending', reason: 'awaiting-pbft-consensus' }
    }
  }

  try {
    const result = await applySealsAndArchive(repo, materialized, sealContext)
    maybeInvalidateLawFromMessage(resolver, materialized)
    return result
  } catch (error) {
    const reason = mapSealFailure(error)
    if (!reason) throw error
    const current = (await repo.snapshotState(materialized.id)) ?? 'pending'
    await appendNextTransition(repo, materialized, current, 'rejected', reason)
    return { messageId, finalState: 'rejected', reason }
  }
}
