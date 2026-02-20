import { describe, expect, it } from 'vitest'
import { buildGateway } from './index'
import { InMemoryArchiveRepository } from '@wenyan/archive'
import { ReliableChannel } from '@wenyan/channel'
import { DEV_SEAL_CONTEXT } from '@wenyan/seal'

describe('gateway boundaries', () => {
  it('rejects malformed payload with 400 (zod)', async () => {
    const app = buildGateway(new InMemoryArchiveRepository(), new ReliableChannel(), DEV_SEAL_CONTEXT)
    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bad: true }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid-payload')
  })

  it('rejects valid payload with invalid seal context as 403', async () => {
    const badSealContext = {
      ...DEV_SEAL_CONTEXT,
      draftPublicKeyHex: 'f'.repeat(64),
    }

    const app = buildGateway(new InMemoryArchiveRepository(), new ReliableChannel(), badSealContext)
    const res = await app.request('/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: `m-${Date.now()}`,
        genre: 'memo',
        payload: { hello: 'world' },
        actor: { id: 'u1', role: 'admin' },
        submittedAt: new Date().toISOString(),
        metadata: {},
      }),
    })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('invalid-seal-chain')
  })
})
