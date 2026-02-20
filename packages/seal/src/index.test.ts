import { describe, expect, it } from 'vitest'
import { DEV_SEAL_CONTEXT, createSealChain, verifySealChain } from './index'
import type { MessageEnvelope } from '@wenyan/core'

const message: MessageEnvelope = {
  id: 'm1',
  genre: 'memo',
  payload: { a: 1 },
  actor: { id: 'u1', role: 'admin' },
  submittedAt: new Date().toISOString(),
  metadata: {},
}

describe('seal', () => {
  it('verifies valid chain', async () => {
    const seals = await createSealChain(message, DEV_SEAL_CONTEXT)
    expect(await verifySealChain(message, seals, DEV_SEAL_CONTEXT)).toBe(true)
  })

  it('rejects tampered chain', async () => {
    const seals = await createSealChain(message, DEV_SEAL_CONTEXT)
    seals[1].payload = { ...(seals[1].payload ?? {}), schemaMerkleRoot: 'tampered' }
    expect(await verifySealChain(message, seals, DEV_SEAL_CONTEXT)).toBe(false)
  })
})
