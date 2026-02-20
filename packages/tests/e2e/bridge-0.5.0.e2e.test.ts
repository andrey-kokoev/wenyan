import { describe, expect, it } from 'vitest'
import { resolveBridgeConflict } from '../../bridge/src/sync'

describe('bridge v0.5.0 smoke', () => {
  it('keeps schism path explicit for irreconcilable concurrent states', () => {
    const resolved = resolveBridgeConflict({
      local: {
        id: 'a',
        genre: 'edict',
        payload: { route: 'old' },
        actor: { id: 'u', role: 'genesis_admin' },
        submittedAt: '2026-05-01T00:00:00.000Z',
        metadata: {},
      },
      remote: {
        id: 'b',
        genre: 'edict',
        payload: { route: 'new' },
        actor: { id: 'u', role: 'genesis_admin' },
        submittedAt: '2026-05-01T00:00:00.000Z',
        metadata: {},
      },
      localClock: { wenyan: 1, foreign: 0 },
      remoteClock: { wenyan: 0, foreign: 1 },
      localHasImperialSeal: false,
      remoteVerified: true,
      strategy: 'schism',
    })
    expect(resolved.status).toBe('schism')
  })
})
