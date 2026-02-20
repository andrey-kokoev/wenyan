import { canAuthorize, canReview } from '@wenyan/actor'
import type { ArchiveRepository } from '@wenyan/archive'
import type { MessageEnvelope, Transition } from '@wenyan/core'
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
  const transitions = repo.getTransitions(messageId)
  const last = transitions[transitions.length - 1]
  return last?.prevTransitionHash ?? 'GENESIS'
}

function nextSeq(repo: ArchiveRepository, messageId: string): number {
  return repo.getTransitions(messageId).length + 1
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
    repo.appendSeal(s)
  }

  const current = repo.snapshotState(message.id) ?? 'pending'
  repo.appendTransition(transition(message, current, 'authorized', nextSeq(repo, message.id), undefined, nextPrevTransitionHash(repo, message.id)))
  repo.appendTransition(transition(message, 'authorized', 'archived', nextSeq(repo, message.id), undefined, nextPrevTransitionHash(repo, message.id)))
  return { messageId: message.id, finalState: 'archived' }
}

export async function finalizePendingMessage(
  repo: ArchiveRepository,
  messageId: string,
  sealContext: SealContext = DEV_SEAL_CONTEXT,
): Promise<PipelineResult> {
  const message = repo.getMessage(messageId)
  if (!message) throw new Error(`Message not found: ${messageId}`)
  return applySealsAndArchive(repo, message, sealContext)
}

export async function processDocketMessage (
  repo: ArchiveRepository,
  messageId: string,
  sealContext: SealContext = DEV_SEAL_CONTEXT,
): Promise<PipelineResult> {
  const message = repo.getMessage(messageId)
  if (!message) {
    throw new Error(`Message not found: ${messageId}`)
  }

  const normalized = caoni(message)

  repo.appendTransition(transition(normalized, 'pending', 'validated', nextSeq(repo, messageId), undefined, nextPrevTransitionHash(repo, messageId)))

  const review = shenfu(normalized)
  if (!review.ok) {
    repo.appendTransition(transition(normalized, 'validated', 'rejected', nextSeq(repo, messageId), review.reason, nextPrevTransitionHash(repo, messageId)))
    return { messageId, finalState: 'rejected', reason: review.reason }
  }

  repo.appendTransition(transition(normalized, 'validated', 'reviewed', nextSeq(repo, messageId), undefined, nextPrevTransitionHash(repo, messageId)))

  const auth = pizhun(normalized)
  if (!auth.ok) {
    repo.appendTransition(transition(normalized, 'reviewed', 'rejected', nextSeq(repo, messageId), auth.reason, nextPrevTransitionHash(repo, messageId)))
    return { messageId, finalState: 'rejected', reason: auth.reason }
  }

  if (destinationCount(normalized) > 1) {
    repo.appendTransition(transition(normalized, 'reviewed', 'pending', nextSeq(repo, messageId), 'awaiting-multi-office-approval', nextPrevTransitionHash(repo, messageId)))
    return { messageId, finalState: 'pending' }
  }

  return applySealsAndArchive(repo, normalized, sealContext)
}
