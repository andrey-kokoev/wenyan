import { describe, expect, it } from 'vitest'
import { NatsIntoWenyanAdapter } from '../../../examples/nats-bridge/adapter'

describe('NATS IntoWenyan forgetting morphism', () => {
  it('drops non-essential headers and maps only subject/data/msg-id', () => {
    const adapter = new NatsIntoWenyanAdapter()
    const env = adapter.toWenyanEnvelope({
      subject: 'war.north.alert',
      data: { level: 'critical' },
      headers: {
        'NATS-Msg-Id': 'nats-123',
        'X-Internal': 'must-be-dropped',
      },
      actorId: 'bridge-agent',
    })

    expect(env.payload.routing).toEqual({ destination: 'war/north/alert' })
    expect(env.metadata.idempotency_key).toBe('nats-123')
    expect((env.metadata as Record<string, unknown>)['X-Internal']).toBeUndefined()
    expect((env.metadata as Record<string, unknown>).nats).toBeUndefined()
  })
})
