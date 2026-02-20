import type { VectorClock } from '@wenyan/core'

export type VectorOrder = 'dominates' | 'dominated' | 'concurrent' | 'equal'

export interface EdictLike {
  id: string
  nodeId: string
  precedence: number
  clock: VectorClock
  payload: Record<string, unknown>
}

export interface MergeResult {
  winner: EdictLike
  mergedClock: VectorClock
  reason: 'clock-dominance' | 'precedence' | 'node-id'
}

function mergedClock(a: VectorClock, b: VectorClock): VectorClock {
  const out: VectorClock = { ...a }
  for (const [k, v] of Object.entries(b)) {
    out[k] = Math.max(out[k] ?? 0, v)
  }
  return out
}

export function compareVectorClock(a: VectorClock, b: VectorClock): VectorOrder {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let aGreater = false
  let bGreater = false
  for (const k of keys) {
    const av = a[k] ?? 0
    const bv = b[k] ?? 0
    if (av > bv) aGreater = true
    if (bv > av) bGreater = true
  }
  if (!aGreater && !bGreater) return 'equal'
  if (aGreater && !bGreater) return 'dominates'
  if (!aGreater && bGreater) return 'dominated'
  return 'concurrent'
}

export function mergeEdict(a: EdictLike, b: EdictLike): MergeResult {
  const cmp = compareVectorClock(a.clock, b.clock)
  if (cmp === 'dominates') {
    return { winner: a, mergedClock: mergedClock(a.clock, b.clock), reason: 'clock-dominance' }
  }
  if (cmp === 'dominated') {
    return { winner: b, mergedClock: mergedClock(a.clock, b.clock), reason: 'clock-dominance' }
  }
  if (a.precedence !== b.precedence) {
    return {
      winner: a.precedence > b.precedence ? a : b,
      mergedClock: mergedClock(a.clock, b.clock),
      reason: 'precedence',
    }
  }
  return {
    winner: a.nodeId.localeCompare(b.nodeId) <= 0 ? a : b,
    mergedClock: mergedClock(a.clock, b.clock),
    reason: 'node-id',
  }
}

export function resolveConcurrentEdict(a: EdictLike, b: EdictLike): EdictLike | { schism: true; a: string; b: string } {
  const cmp = compareVectorClock(a.clock, b.clock)
  if (cmp === 'concurrent' && a.precedence === b.precedence && a.nodeId === b.nodeId) {
    return { schism: true, a: a.id, b: b.id }
  }
  return mergeEdict(a, b).winner
}
