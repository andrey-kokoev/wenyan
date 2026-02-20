import { describe, expect, it } from 'vitest'
import { compareVectorClock, mergeEdict, resolveConcurrentEdict, type EdictLike } from './index'

function edict(overrides: Partial<EdictLike>): EdictLike {
  return {
    id: 'e1',
    nodeId: 'node-a',
    precedence: 0,
    clock: { 'node-a': 1 },
    payload: {},
    ...overrides,
  }
}

describe('crdt merge', () => {
  it('compares vector clocks deterministically', () => {
    expect(compareVectorClock({ a: 2 }, { a: 1 })).toBe('dominates')
    expect(compareVectorClock({ a: 1 }, { a: 2 })).toBe('dominated')
    expect(compareVectorClock({ a: 1, b: 0 }, { a: 1, b: 0 })).toBe('equal')
    expect(compareVectorClock({ a: 1, b: 2 }, { a: 2, b: 1 })).toBe('concurrent')
  })

  it('prefers higher precedence when clocks are concurrent', () => {
    const a = edict({ id: 'a', precedence: 1, clock: { a: 2, b: 1 }, nodeId: 'node-a' })
    const b = edict({ id: 'b', precedence: 3, clock: { a: 1, b: 2 }, nodeId: 'node-b' })
    const merged = mergeEdict(a, b)
    expect(merged.reason).toBe('precedence')
    expect(merged.winner.id).toBe('b')
    expect(merged.mergedClock).toEqual({ a: 2, b: 2 })
  })

  it('uses lexicographic node id tie-break and exposes schism edge', () => {
    const a = edict({ id: 'a', nodeId: 'node-a', clock: { a: 1 }, precedence: 1 })
    const b = edict({ id: 'b', nodeId: 'node-b', clock: { b: 1 }, precedence: 1 })
    expect(mergeEdict(a, b).winner.id).toBe('a')

    const schism = resolveConcurrentEdict(
      edict({ id: 'x', nodeId: 'same', precedence: 1, clock: { a: 1 } }),
      edict({ id: 'y', nodeId: 'same', precedence: 1, clock: { b: 1 } }),
    )
    expect('schism' in schism && schism.schism).toBe(true)
  })
})
