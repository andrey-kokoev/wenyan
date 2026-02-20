import { describe, expect, it } from 'vitest'
import { ImperialBroadcast, InMemoryPlumtree, SwimMembership } from './index'

describe('gossip primitives', () => {
  it('transitions membership via suspect/dead and heartbeat recovery', async () => {
    const membership = new SwimMembership(5_000)
    membership.upsert('n1', 'gossip://n1:7946')
    membership.heartbeat('n1')
    membership.suspect('n1')
    expect(membership.list()[0]?.state).toBe('suspect')
    membership.heartbeat('n1')
    expect(membership.list()[0]?.state).toBe('alive')
    membership.markDead('n1')
    expect(membership.list()[0]?.state).toBe('dead')
    expect(membership.isPartitioned()).toBe(true)
  })

  it('dedupes eager/lazy plumtree delivery', () => {
    const tree = new InMemoryPlumtree(2)
    const recipients = tree.eagerPush({ id: 'm1', topic: 'seal', payload: {} })
    expect(recipients).toEqual(['peer-1', 'peer-2'])
    expect(tree.lazyDigest(['m1', 'm2'])).toEqual(['m2'])
  })

  it('dedupes imperial broadcast delivery', () => {
    const imperial = new ImperialBroadcast()
    expect(imperial.deliver({ id: 'i1', topic: 'seal6', payload: {} })).toBe(true)
    expect(imperial.deliver({ id: 'i1', topic: 'seal6', payload: {} })).toBe(false)
    expect(imperial.deliveredCount()).toBe(1)
  })
})
