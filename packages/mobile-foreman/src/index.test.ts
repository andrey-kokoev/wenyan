import { describe, expect, it } from 'vitest'
import { createOfflineStore, queueReviewSeal, resolveConcurrentReview, syncWithMinister } from './index'

describe('mobile foreman PWA primitives', () => {
  it('queues seals offline and syncs deterministically', () => {
    const store = createOfflineStore()
    queueReviewSeal(store, 'm1', ['s2', 's3', 's4', 's5'])
    const sync = syncWithMinister({ store, localRoot: 'a', remoteRoot: 'b' })
    expect(sync.transferred).toBe(1)
    expect(sync.localRoot.length).toBeGreaterThan(10)
  })

  it('resolves concurrent review winner', () => {
    const out = resolveConcurrentReview({
      messageId: 'm2',
      firstReviewer: 'foreman_a',
      secondReviewer: 'foreman_b',
      firstAtIso: '2026-01-01T00:00:00.000Z',
      secondAtIso: '2026-01-01T00:00:01.000Z',
    })
    expect(out.concurrentReview).toBe(true)
  })
})
