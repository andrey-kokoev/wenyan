import { describe, expect, it } from 'vitest'
import { InMemoryArchiveRepository } from '@wenyan/archive'
import { processDocketMessage } from './index'

describe('pipeline', () => {
  it('produces 6 seals for successful path', async () => {
    const repo = new InMemoryArchiveRepository()
    const message = {
      id: 'm1',
      genre: 'memo',
      payload: { a: 1 },
      actor: { id: 'u1', role: 'admin' as const },
      submittedAt: new Date().toISOString(),
      metadata: {},
    }

    repo.appendMessage(message)
    const result = await processDocketMessage(repo, 'm1')

    expect(result.finalState).toBe('archived')
    expect(repo.getSeals('m1')).toHaveLength(6)
  })
})
