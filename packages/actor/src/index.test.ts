import { describe, expect, it } from 'vitest'
import { canAuthorize, canDraft, canReview } from './index'

describe('actor matrix', () => {
  it('admin can do all actions', () => {
    expect(canDraft('admin')).toBe(true)
    expect(canReview('admin')).toBe(true)
    expect(canAuthorize('admin')).toBe(true)
  })

  it('scribe cannot authorize', () => {
    expect(canAuthorize('scribe')).toBe(false)
  })

  it('uses appointment law when provided', () => {
    const law = {
      roles: {
        censor: {
          permissions: ['review'],
          allowed_genres: ['petition'],
        },
      },
    }
    expect(canReview('censor', law)).toBe(true)
    expect(canAuthorize('censor', law)).toBe(false)
  })
})
