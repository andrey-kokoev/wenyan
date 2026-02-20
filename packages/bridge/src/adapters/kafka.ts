import type { BridgeAdapterConfig, KafkaBridgeAdapterConfig, MessageEnvelope } from '@wenyan/core'
import type { AdapterContext, BridgeAdapter, ForeignMetadata, FromWenyan, IntoWenyan, TranslationResult } from '../types'

interface KafkaPayload {
  topic: string
  partition: number
  offset: string
  key?: string
  value: Record<string, unknown>
  headers: Record<string, string>
}

class KafkaIntoWenyanAdapter implements IntoWenyan<KafkaPayload> {
  constructor(private readonly config: KafkaBridgeAdapterConfig) {}

  translate(payload: KafkaPayload, metadata: ForeignMetadata): TranslationResult {
    return {
      ok: true,
      document: {
        id: this.extractIdempotencyKey(payload, metadata),
        genre: this.config.target_genre,
        payload: payload.value,
        actor: { id: `bridge:${this.config.id}`, role: 'bridge_adapter' },
        submittedAt: metadata.timestampIso,
        metadata: {
          idempotency_key: this.extractIdempotencyKey(payload, metadata),
          correlation_id: payload.key ?? null,
          routing: { destination: `${payload.topic}/${payload.partition}` },
          provenance: { foreign: 'kafka', trusted: this.config.trust_provenance },
          kafka: {
            topic: payload.topic,
            partition: payload.partition,
            offset: payload.offset,
          },
        },
      },
    }
  }

  extractIdempotencyKey(payload: KafkaPayload, _metadata?: ForeignMetadata): string {
    return `${payload.topic}:${payload.partition}:${payload.offset}`
  }

  async verifyProvenance(_payload: KafkaPayload): Promise<boolean> {
    return this.config.trust_provenance
  }
}

class KafkaFromWenyanAdapter implements FromWenyan<KafkaPayload> {
  translate(document: MessageEnvelope): KafkaPayload {
    return {
      topic: document.genre,
      partition: 0,
      offset: String(Date.now()),
      value: document.payload,
      headers: { 'Wenyan-Seal-6-Hash': document.id },
    }
  }

  reconcile(local: KafkaPayload, remote: MessageEnvelope): KafkaPayload {
    return { ...local, value: remote.payload }
  }
}

export class KafkaBridgeAdapter implements BridgeAdapter {
  readonly protocol = 'kafka' as const
  readonly config: BridgeAdapterConfig
  readonly id: string
  readonly into: IntoWenyan<unknown>
  readonly from: FromWenyan<unknown>
  private running = false

  constructor(config: KafkaBridgeAdapterConfig) {
    this.config = config
    this.id = config.id
    this.into = new KafkaIntoWenyanAdapter(config) as IntoWenyan<unknown>
    this.from = new KafkaFromWenyanAdapter() as FromWenyan<unknown>
  }

  async start(_ctx: AdapterContext): Promise<void> {
    // Staged adapter: runtime contract complete; broker wiring is intentionally deferred.
    this.running = true
  }

  async stop(): Promise<void> {
    this.running = false
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    return this.running ? { ok: true, detail: 'staged-adapter' } : { ok: false, detail: 'stopped' }
  }

  async publishOutbound(document: MessageEnvelope): Promise<{ foreignId: string }> {
    const msg = this.from.translate(document) as KafkaPayload
    return { foreignId: `${msg.topic}:${msg.partition}:${msg.offset}` }
  }

  async simulateInbound(payload: KafkaPayload, ctx: AdapterContext): Promise<void> {
    const metadata: ForeignMetadata = {
      protocol: 'kafka',
      adapterId: this.id,
      subjectOrTopic: payload.topic,
      headers: payload.headers,
      timestampIso: new Date().toISOString(),
    }
    await ctx.onInbound(this, payload, metadata)
  }
}
