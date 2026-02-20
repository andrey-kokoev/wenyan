import { describe, expect, it } from 'vitest'
import { merkleRoot } from './merkle'

describe('merkle', () => {
  it('is deterministic for same ordered input', () => {
    const a = merkleRoot(['a', 'b', 'c'])
    const b = merkleRoot(['a', 'b', 'c'])
    expect(a).toBe(b)
  })

  it('changes when order changes', () => {
    const a = merkleRoot(['a', 'b', 'c'])
    const b = merkleRoot(['c', 'b', 'a'])
    expect(a).not.toBe(b)
  })
})
