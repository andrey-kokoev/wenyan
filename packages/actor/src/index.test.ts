import { describe, expect, it } from 'vitest'
import { canAuthorize, canDraft, canReview } from './index'

describe('actor matrix', () => {
  it('fails closed without appointment law', () => {
    expect(canDraft('admin')).toBe(false)
    expect(canReview('admin')).toBe(false)
    expect(canAuthorize('admin')).toBe(false)
  })

  it('scribe cannot authorize', () => {
    expect(canAuthorize('scribe')).toBe(false)
  })

  it('uses appointment law when provided', () => {
    const law = {
      roles: {
        admin: {
          permissions: ['draft', 'review', 'authorize'],
          allowed_genres: ['*'],
        },
        censor: {
          permissions: ['review'],
          allowed_genres: ['petition'],
        },
      },
    }
    expect(canDraft('admin', law)).toBe(true)
    expect(canReview('admin', law)).toBe(true)
    expect(canAuthorize('admin', law)).toBe(true)
    expect(canReview('censor', law)).toBe(true)
    expect(canAuthorize('censor', law)).toBe(false)
  })
})
