import type { ArchiveRepository } from './index'
import type { MessageEnvelope, Transition } from '@andrey-kokoev/wenyan-core'

export interface SyncRemote {
  getMerkleRoot(scope?: 'all' | 'constitutional' | 'legislative'): Promise<string>
  getSyncRange(fromCursor: string, limit: number): Promise<Array<Record<string, unknown>>>
  getMessage?(messageId: string): Promise<MessageEnvelope | undefined>
}

export interface SyncResult {
  localRoot: string
  remoteRoot: string
  diverged: boolean
  fetched: number
  applied: number
  skipped: number
  unresolved: number
}

function asTransition(raw: Record<string, unknown>): Transition | undefined {
  if (
    typeof raw.messageId !== 'string' ||
    typeof raw.fromState !== 'string' ||
    typeof raw.toState !== 'string' ||
    typeof raw.sequenceNo !== 'number' ||
    typeof raw.at !== 'string'
  ) {
    return undefined
  }
  const t: Transition = {
    messageId: raw.messageId,
    fromState: raw.fromState as Transition['fromState'],
    toState: raw.toState as Transition['toState'],
    sequenceNo: raw.sequenceNo,
    at: raw.at,
  }
  if (typeof raw.actorId === 'string') t.actorId = raw.actorId
  if (typeof raw.sealedAt === 'string') t.sealedAt = raw.sealedAt
  if (typeof raw.reason === 'string') t.reason = raw.reason
  if (typeof raw.prevTransitionHash === 'string') t.prevTransitionHash = raw.prevTransitionHash
  return t
}

export async function syncWithPeer(
  local: ArchiveRepository,
  remote: SyncRemote,
  options: { fromCursor?: string; limit?: number; scope?: 'all' | 'constitutional' | 'legislative' } = {},
): Promise<SyncResult> {
  const scope = options.scope ?? 'all'
  const localRoot = await local.getMerkleRoot(scope)
  const remoteRoot = await remote.getMerkleRoot(scope)
  if (localRoot === remoteRoot) {
    return { localRoot, remoteRoot, diverged: false, fetched: 0, applied: 0, skipped: 0, unresolved: 0 }
  }
  const fromCursor = options.fromCursor ?? '0'
  const limit = options.limit ?? 200
  const range = await remote.getSyncRange(fromCursor, limit)

  let applied = 0
  let skipped = 0
  let unresolved = 0
  for (const raw of range) {
    const t = asTransition(raw)
    if (!t) {
      skipped += 1
      continue
    }

    let msg = await local.getMessage(t.messageId)
    if (!msg && remote.getMessage) {
      const remoteMsg = await remote.getMessage(t.messageId)
      if (remoteMsg) {
        await local.appendMessage(remoteMsg)
        msg = remoteMsg
      }
    }
    if (!msg) {
      unresolved += 1
      continue
    }

    const existing = await local.getTransitions(t.messageId)
    const dup = existing.some(
      (x) => x.sequenceNo === t.sequenceNo && x.fromState === t.fromState && x.toState === t.toState,
    )
    if (dup) {
      skipped += 1
      continue
    }

    await local.appendTransition(t)
    applied += 1
  }

  return {
    localRoot: await local.getMerkleRoot(scope),
    remoteRoot,
    diverged: true,
    fetched: range.length,
    applied,
    skipped,
    unresolved,
  }
}
