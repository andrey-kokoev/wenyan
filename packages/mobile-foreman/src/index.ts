import { createHash } from 'node:crypto'

export interface OfflineQueueItem {
  messageId: string
  seals2to5: string[]
  pendingImperial: boolean
  createdAt: string
}

export interface OfflineStore {
  queue: OfflineQueueItem[]
  conflicts: Array<{ messageId: string; reason: string }>
}

export function createOfflineStore(): OfflineStore {
  return { queue: [], conflicts: [] }
}

export function queueReviewSeal(store: OfflineStore, messageId: string, seals2to5: string[]): OfflineStore {
  store.queue.push({ messageId, seals2to5, pendingImperial: true, createdAt: new Date().toISOString() })
  return store
}

export function queueImperialRequest(store: OfflineStore, messageId: string): OfflineStore {
  const found = store.queue.find((x) => x.messageId === messageId)
  if (found) found.pendingImperial = true
  return store
}

function digest(items: OfflineQueueItem[]): string {
  return createHash('sha256').update(JSON.stringify(items.map((x) => ({ id: x.messageId, seals: x.seals2to5 })))).digest('hex')
}

export function syncWithMinister(input: {
  store: OfflineStore
  localRoot: string
  remoteRoot: string
}): { transferred: number; converged: boolean; localRoot: string } {
  const nextRoot = digest(input.store.queue)
  const converged = input.localRoot === input.remoteRoot || input.remoteRoot === nextRoot
  return { transferred: input.store.queue.length, converged, localRoot: nextRoot }
}

export function resolveConcurrentReview(input: {
  messageId: string
  firstReviewer: string
  secondReviewer: string
  firstAtIso: string
  secondAtIso: string
}): { winner: string; reason: 'first' | 'second'; concurrentReview: boolean } {
  if (new Date(input.firstAtIso).getTime() <= new Date(input.secondAtIso).getTime()) {
    return { winner: input.firstReviewer, reason: 'first', concurrentReview: true }
  }
  return { winner: input.secondReviewer, reason: 'second', concurrentReview: true }
}
