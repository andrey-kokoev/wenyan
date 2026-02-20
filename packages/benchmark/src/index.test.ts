import { describe, expect, it } from 'vitest'
import { parseProfile } from './index'

describe('benchmark profile parser', () => {
  it('defaults to toy', () => {
    expect(parseProfile([])).toBe('toy')
  })

  it('reads stress profile', () => {
    expect(parseProfile(['--profile', 'stress'])).toBe('stress')
  })
})
