import { canAuthorize, canReview } from '@wenyan/actor'
import type { ArchiveRepository } from '@wenyan/archive'
import { validateTiDefinition, type MessageEnvelope, type Transition } from '@wenyan/core'
import { DEV_SEAL_CONTEXT, createSealChain, verifySealChain, type SealContext } from '@wenyan/seal'

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

function validateAgainstStoredSchema(payload: Record<string, unknown>, schema: Record<string, unknown>): boolean {
  const required = Array.isArray(schema.required) ? schema.required : []
  for (const key of required) {
    if (typeof key === 'string' && !(key in payload)) return false
  }
  const properties = schema.properties
  if (!properties || typeof properties !== 'object') return true
  for (const [key, rule] of Object.entries(properties as Record<string, unknown>)) {
    if (!(key in payload)) continue
    const value = payload[key]
    const type = (rule as { type?: unknown }).type
    if (type === 'string' && typeof value !== 'string') return false
    if (type === 'number' && typeof value !== 'number') return false
    if (type === 'boolean' && typeof value !== 'boolean') return false
    if (type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) return false
    if (type === 'array' && !Array.isArray(value)) return false
  }
  return true
}

function transition (
  message: MessageEnvelope,
  fromState: Transition['fromState'],
  toState: Transition['toState'],
  sequenceNo: number,
  reason?: string,
  prevTransitionHash?: string,
): Transition {
  return {
    messageId: message.id,
    fromState,
    toState,
    sequenceNo,
    actorId: message.actor.id,
    sealedAt: new Date().toISOString(),
    reason,
    prevTransitionHash,
    at: new Date().toISOString(),
  }
}

function nextPrevTransitionHash(repo: ArchiveRepository, messageId: string): string {
  const transitions = repo.getTransitions(messageId) as Transition[]
  const last = transitions[transitions.length - 1]
  return last?.prevTransitionHash ?? 'GENESIS'
}

function nextSeq(repo: ArchiveRepository, messageId: string): number {
  return (repo.getTransitions(messageId) as Transition[]).length + 1
}

function destinationCount(message: MessageEnvelope): number {
  const raw = (message.payload as Record<string, unknown>).routing as Record<string, unknown> | undefined
  const dest = raw?.destination
  if (Array.isArray(dest)) return dest.length
  return 1
}

export function caoni (message: MessageEnvelope): MessageEnvelope {
  return {
    ...message,
    payload: Object.fromEntries(Object.entries(message.payload).map(([k, v]) => [k.trim(), v])),
  }
}

export function shenfu (message: MessageEnvelope): { ok: true } | { ok: false; reason: string } {
  if (!canReview(message.actor.role)) {
    return { ok: false, reason: 'actor-cannot-review' }
  }
  if (Object.keys(message.payload).length === 0) {
    return { ok: false, reason: 'empty-payload' }
  }
  return { ok: true }
}

async function shenfuSchema(message: MessageEnvelope, repo: ArchiveRepository): Promise<{ ok: true } | { ok: false; reason: string }> {
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
  return validateAgainstStoredSchema(message.payload, schema)
    ? { ok: true }
    : { ok: false, reason: 'schema-noncompliant' }
}

export function pizhun (message: MessageEnvelope): { ok: true } | { ok: false; reason: string } {
  if (!canAuthorize(message.actor.role)) {
    return { ok: false, reason: 'actor-cannot-authorize' }
  }
  return { ok: true }
}

async function applySealsAndArchive(repo: ArchiveRepository, message: MessageEnvelope, sealContext: SealContext): Promise<PipelineResult> {
  const seals = await createSealChain(message, sealContext)
  const valid = await verifySealChain(message, seals, sealContext)
  if (!valid) {
    throw new SealInvalidError()
  }

  for (const s of seals) {
    await repo.appendSeal(s)
  }

  const current = (await repo.snapshotState(message.id)) ?? 'pending'
  const seq1 = (await repo.getTransitions(message.id)).length + 1
  const prev1 = ((await repo.getTransitions(message.id)).at(-1)?.prevTransitionHash) ?? 'GENESIS'
  await repo.appendTransition(transition(message, current, 'authorized', seq1, undefined, prev1))
  const seq2 = (await repo.getTransitions(message.id)).length + 1
  const prev2 = ((await repo.getTransitions(message.id)).at(-1)?.prevTransitionHash) ?? 'GENESIS'
  await repo.appendTransition(transition(message, 'authorized', 'archived', seq2, undefined, prev2))
  return { messageId: message.id, finalState: 'archived' }
}

export async function finalizePendingMessage(
  repo: ArchiveRepository,
  messageId: string,
  sealContext: SealContext = DEV_SEAL_CONTEXT,
): Promise<PipelineResult> {
  const message = repo.getMessage(messageId)
  const messageResolved = await message
  if (!messageResolved) throw new Error(`Message not found: ${messageId}`)
  return applySealsAndArchive(repo, messageResolved, sealContext)
}

export async function processDocketMessage (
  repo: ArchiveRepository,
  messageId: string,
  sealContext: SealContext = DEV_SEAL_CONTEXT,
): Promise<PipelineResult> {
  const message = await repo.getMessage(messageId)
  if (!message) {
    throw new Error(`Message not found: ${messageId}`)
  }

  const normalized = caoni(message)

  const seq1 = (await repo.getTransitions(messageId)).length + 1
  const prev1 = ((await repo.getTransitions(messageId)).at(-1)?.prevTransitionHash) ?? 'GENESIS'
  await repo.appendTransition(transition(normalized, 'pending', 'validated', seq1, undefined, prev1))

  const review = shenfu(normalized)
  if (!review.ok) {
    const seq = (await repo.getTransitions(messageId)).length + 1
    const prev = ((await repo.getTransitions(messageId)).at(-1)?.prevTransitionHash) ?? 'GENESIS'
    await repo.appendTransition(transition(normalized, 'validated', 'rejected', seq, review.reason, prev))
    return { messageId, finalState: 'rejected', reason: review.reason }
  }
  const schemaReview = await shenfuSchema(normalized, repo)
  if (!schemaReview.ok) {
    const seq = (await repo.getTransitions(messageId)).length + 1
    const prev = ((await repo.getTransitions(messageId)).at(-1)?.prevTransitionHash) ?? 'GENESIS'
    await repo.appendTransition(transition(normalized, 'validated', 'rejected', seq, schemaReview.reason, prev))
    return { messageId, finalState: 'rejected', reason: schemaReview.reason }
  }

  const seq2 = (await repo.getTransitions(messageId)).length + 1
  const prev2 = ((await repo.getTransitions(messageId)).at(-1)?.prevTransitionHash) ?? 'GENESIS'
  await repo.appendTransition(transition(normalized, 'validated', 'reviewed', seq2, undefined, prev2))

  const auth = pizhun(normalized)
  if (!auth.ok) {
    const seq = (await repo.getTransitions(messageId)).length + 1
    const prev = ((await repo.getTransitions(messageId)).at(-1)?.prevTransitionHash) ?? 'GENESIS'
    await repo.appendTransition(transition(normalized, 'reviewed', 'rejected', seq, auth.reason, prev))
    return { messageId, finalState: 'rejected', reason: auth.reason }
  }

  if (destinationCount(normalized) > 1) {
    const seq = (await repo.getTransitions(messageId)).length + 1
    const prev = ((await repo.getTransitions(messageId)).at(-1)?.prevTransitionHash) ?? 'GENESIS'
    await repo.appendTransition(transition(normalized, 'reviewed', 'pending', seq, 'awaiting-multi-office-approval', prev))
    return { messageId, finalState: 'pending' }
  }

  return applySealsAndArchive(repo, normalized, sealContext)
}
