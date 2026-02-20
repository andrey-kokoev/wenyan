import { z } from 'zod'

const payloadSchema = z.record(z.string(), z.unknown())

export interface NatsMessage {
  subject: string
  data: unknown
  headers?: Record<string, string>
  actorId: string
}

export interface IntoWenyan {
  toWenyanEnvelope(msg: NatsMessage): {
    id: string
    genre: string
    payload: Record<string, unknown>
    actor: { id: string; role: 'scribe' | 'reviewer' | 'approver' | 'archivist' | 'admin' }
    submittedAt: string
    metadata: Record<string, unknown>
  }
}

function parseDestination(subject: string): string {
  return subject.split('.').filter(Boolean).join('/') || 'default'
}

export class NatsIntoWenyanAdapter implements IntoWenyan {
  toWenyanEnvelope(msg: NatsMessage) {
    // Forgetful morphism: only keep subject, payload, and NATS-Msg-Id.
    const payload = payloadSchema.parse(msg.data)
    const idempotencyKey = msg.headers?.['NATS-Msg-Id']

    return {
      id: `${parseDestination(msg.subject)}-${Date.now()}`,
      genre: 'nats-adapted',
      payload: {
        ...payload,
        routing: {
          destination: parseDestination(msg.subject),
        },
      },
      actor: { id: msg.actorId, role: 'admin' as const },
      submittedAt: new Date().toISOString(),
      metadata: {
        source: 'nats-bridge',
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      },
    }
  }
}
