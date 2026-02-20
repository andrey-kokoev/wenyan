export interface NatsMessage {
  subject: string
  data: Record<string, unknown>
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

export class NatsIntoWenyanAdapter implements IntoWenyan {
  toWenyanEnvelope(msg: NatsMessage) {
    return {
      id: `${msg.subject}-${Date.now()}`,
      genre: msg.subject,
      payload: msg.data,
      actor: { id: msg.actorId, role: 'admin' },
      submittedAt: new Date().toISOString(),
      metadata: { source: 'nats-bridge' },
    }
  }
}
