import { compareVectorClock, mergeEdict } from '@andrey-kokoev/wenyan-crdt'
import type { MessageEnvelope, VectorClock } from '@andrey-kokoev/wenyan-core'

export type BridgeConflictStrategy = 'lww' | 'merge' | 'schism'

export interface SyncResolutionInput {
  local: MessageEnvelope
  remote: MessageEnvelope
  localClock: VectorClock
  remoteClock: VectorClock
  localHasImperialSeal: boolean
  remoteVerified: boolean
  strategy?: BridgeConflictStrategy
}

export interface SyncResolutionResult {
  winner: MessageEnvelope
  mergedClock: VectorClock
  status: 'resolved' | 'schism'
  reason: 'local-imperial' | 'vector-clock' | 'lww' | 'merge' | 'schism'
}

function mergePayload(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  return { ...left, ...right }
}

export function resolveBridgeConflict(input: SyncResolutionInput): SyncResolutionResult {
  if (input.localHasImperialSeal && !input.remoteVerified) {
    return {
      winner: input.local,
      mergedClock: { ...input.localClock, ...input.remoteClock },
      status: 'resolved',
      reason: 'local-imperial',
    }
  }

  const relation = compareVectorClock(input.localClock, input.remoteClock)
  if (relation === 'dominates') {
    return {
      winner: input.local,
      mergedClock: { ...input.localClock, ...input.remoteClock },
      status: 'resolved',
      reason: 'vector-clock',
    }
  }
  if (relation === 'dominated') {
    return {
      winner: input.remote,
      mergedClock: { ...input.localClock, ...input.remoteClock },
      status: 'resolved',
      reason: 'vector-clock',
    }
  }

  const strategy = input.strategy ?? 'lww'
  if (strategy === 'lww') {
    const left = new Date(input.local.submittedAt).getTime()
    const right = new Date(input.remote.submittedAt).getTime()
    return {
      winner: left >= right ? input.local : input.remote,
      mergedClock: { ...input.localClock, ...input.remoteClock },
      status: 'resolved',
      reason: 'lww',
    }
  }

  if (strategy === 'merge') {
    return {
      winner: {
        ...input.local,
        payload: mergePayload(input.local.payload, input.remote.payload),
      },
      mergedClock: { ...input.localClock, ...input.remoteClock },
      status: 'resolved',
      reason: 'merge',
    }
  }

  const winner = mergeEdict(
    {
      id: input.local.id,
      nodeId: 'wenyan',
      precedence: 0,
      clock: input.localClock,
      payload: input.local.payload,
    },
    {
      id: input.remote.id,
      nodeId: 'foreign',
      precedence: 0,
      clock: input.remoteClock,
      payload: input.remote.payload,
    },
  ).winner

  return {
    winner: winner.id === input.local.id ? input.local : input.remote,
    mergedClock: { ...input.localClock, ...input.remoteClock },
    status: 'schism',
    reason: 'schism',
  }
}
