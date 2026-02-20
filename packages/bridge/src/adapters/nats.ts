import { StringCodec, connect, type Msg, type NatsConnection } from 'nats'
import type { BridgeAdapterConfig, MessageEnvelope, NatsBridgeAdapterConfig } from '@wenyan/core'
import type { AdapterContext, BridgeAdapter, ForeignMetadata, FromWenyan, IntoWenyan, TranslationResult } from '../types'

interface NatsForeignPayload {
  subject: string
  data: unknown
  headers: Record<string, string>
  publisherId?: string
}

function asObject(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
  return input as Record<string, unknown>
}

export class NatsIntoWenyanAdapter implements IntoWenyan<NatsForeignPayload> {
  constructor(private readonly config: NatsBridgeAdapterConfig) {}

  translate(payload: NatsForeignPayload, metadata: ForeignMetadata): TranslationResult {
    const obj = asObject(payload.data)
    if (!obj) {
      return { ok: false, error: { code: 'invalid-payload', message: 'nats payload must be a JSON object' } }
    }

    const idempotency = this.extractIdempotencyKey(payload, metadata)
    return {
      ok: true,
      document: {
        id: idempotency || `nats-${Date.now()}`,
        genre: this.config.target_genre,
        payload: obj,
        actor: {
          id: `bridge:${this.config.id}`,
          role: 'bridge_adapter',
        },
        submittedAt: metadata.timestampIso,
        metadata: {
          idempotency_key: idempotency,
          routing: { destination: payload.subject.replaceAll('.', '/') },
          provenance: {
            foreign: 'nats',
            trusted: this.config.trust_provenance,
          },
        },
      },
    }
  }

  extractIdempotencyKey(payload: NatsForeignPayload, metadata: ForeignMetadata): string {
    const header = this.config.idempotency_header ?? 'Nats-Msg-Id'
    return payload.headers[header] ?? metadata.headers[header] ?? `${payload.subject}:${metadata.timestampIso}`
  }

  async verifyProvenance(_payload: NatsForeignPayload, metadata: ForeignMetadata): Promise<boolean> {
    return this.config.trust_provenance || metadata.publisherId === 'attested'
  }
}

export class NatsFromWenyanAdapter implements FromWenyan<{ subject: string; headers: Record<string, string>; data: Record<string, unknown> }> {
  translate(document: MessageEnvelope): { subject: string; headers: Record<string, string>; data: Record<string, unknown> } {
    const routing = document.metadata?.routing as { destination?: string | string[] } | undefined
    const dest = Array.isArray(routing?.destination) ? routing?.destination[0] : routing?.destination
    const subject = (dest ?? `${document.genre}.events`).replaceAll('/', '.')
    return {
      subject,
      headers: {
        'Wenyan-Seal-6-Hash': String(document.id),
        'Imperial-Authority': 'true',
      },
      data: document.payload,
    }
  }

  reconcile(local: { subject: string; headers: Record<string, string>; data: Record<string, unknown> }, remote: MessageEnvelope): {
    subject: string
    headers: Record<string, string>
    data: Record<string, unknown>
  } {
    return { ...local, data: remote.payload }
  }
}

export class NatsBridgeAdapter implements BridgeAdapter {
  readonly protocol = 'nats' as const
  readonly into: IntoWenyan<unknown>
  readonly from: FromWenyan<unknown>
  readonly config: BridgeAdapterConfig
  readonly id: string

  private nc: NatsConnection | undefined
  private readonly sc = StringCodec()

  constructor(config: NatsBridgeAdapterConfig) {
    this.config = config
    this.id = config.id
    this.into = new NatsIntoWenyanAdapter(config) as IntoWenyan<unknown>
    this.from = new NatsFromWenyanAdapter() as FromWenyan<unknown>
  }

  async start(ctx: AdapterContext): Promise<void> {
    const cfg = this.config as NatsBridgeAdapterConfig
    this.nc = await connect({ servers: cfg.url })
    for (const subject of cfg.subject_pattern) {
      const sub = this.nc.subscribe(subject)
      ;(async () => {
        for await (const msg of sub) {
          await this.handleMessage(msg, ctx)
        }
      })()
    }
  }

  async stop(): Promise<void> {
    await this.nc?.drain()
    await this.nc?.close()
    this.nc = undefined
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.nc) return { ok: false, detail: 'not-connected' }
    return { ok: true }
  }

  async publishOutbound(document: MessageEnvelope): Promise<{ foreignId: string }> {
    if (!this.nc) throw new Error('nats adapter not connected')
    const mapped = this.from.translate(document) as { subject: string; headers: Record<string, string>; data: Record<string, unknown> }
    this.nc.publish(mapped.subject, this.sc.encode(JSON.stringify(mapped.data)))
    return { foreignId: `${mapped.subject}:${document.id}` }
  }

  private async handleMessage(msg: Msg, ctx: AdapterContext): Promise<void> {
    const headers: Record<string, string> = {}
    for (const [k, v] of msg.headers ?? []) headers[k] = Array.isArray(v) ? (v[0] ?? '') : v
    let parsed: unknown = {}
    try {
      parsed = JSON.parse(this.sc.decode(msg.data))
    } catch {
      parsed = { raw: this.sc.decode(msg.data) }
    }
    const payload: NatsForeignPayload = {
      subject: msg.subject,
      data: parsed,
      headers,
    }
    await ctx.onInbound(this, payload, {
      protocol: 'nats',
      adapterId: this.id,
      subjectOrTopic: msg.subject,
      headers,
      timestampIso: new Date().toISOString(),
    })
  }
}
