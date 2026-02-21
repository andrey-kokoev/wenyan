import type { BridgeAdapterConfig, MessageEnvelope, MqttBridgeAdapterConfig } from '@andrey-kokoev/wenyan-core'
import type { AdapterContext, BridgeAdapter, ForeignMetadata, FromWenyan, IntoWenyan, TranslationResult } from '../types'

interface MqttPayload {
  topic: string
  payload: Record<string, unknown>
  qos: 0 | 1 | 2
  retain?: boolean
  headers: Record<string, string>
}

class MqttIntoWenyanAdapter implements IntoWenyan<MqttPayload> {
  constructor(private readonly config: MqttBridgeAdapterConfig) {}

  translate(payload: MqttPayload, metadata: ForeignMetadata): TranslationResult {
    const metadataMode = this.config.metadata_mode ?? 'strict'
    const baseMetadata: Record<string, unknown> = {
      idempotency_key: this.extractIdempotencyKey(payload, metadata),
      routing: { destination: payload.topic.replaceAll('/', '.') },
      provenance: { foreign: 'mqtt', trusted: this.config.trust_provenance },
    }
    if (metadataMode === 'compat') {
      baseMetadata.mqtt = { qos: payload.qos, retain: payload.retain === true }
    }
    return {
      ok: true,
      document: {
        id: this.extractIdempotencyKey(payload, metadata),
        genre: this.config.target_genre,
        payload: payload.payload,
        actor: { id: `bridge:${this.config.id}`, role: 'bridge_adapter' },
        submittedAt: metadata.timestampIso,
        metadata: baseMetadata,
      },
    }
  }

  extractIdempotencyKey(payload: MqttPayload, _metadata?: ForeignMetadata): string {
    return `${payload.topic}:${JSON.stringify(payload.payload)}`
  }

  async verifyProvenance(_payload: MqttPayload): Promise<boolean> {
    return this.config.trust_provenance ?? false
  }
}

class MqttFromWenyanAdapter implements FromWenyan<MqttPayload> {
  translate(document: MessageEnvelope): MqttPayload {
    const topic = document.genre.replaceAll('.', '/')
    return {
      topic,
      payload: document.payload,
      qos: 1,
      retain: true,
      headers: { 'Wenyan-Seal-6-Hash': document.id },
    }
  }

  reconcile(local: MqttPayload, remote: MessageEnvelope): MqttPayload {
    return { ...local, payload: remote.payload }
  }
}

export class MqttBridgeAdapter implements BridgeAdapter {
  readonly protocol = 'mqtt' as const
  readonly config: BridgeAdapterConfig
  readonly id: string
  readonly into: IntoWenyan<unknown>
  readonly from: FromWenyan<unknown>
  private running = false

  constructor(config: MqttBridgeAdapterConfig) {
    this.config = config
    this.id = config.id
    this.into = new MqttIntoWenyanAdapter(config) as IntoWenyan<unknown>
    this.from = new MqttFromWenyanAdapter() as FromWenyan<unknown>
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
    const msg = this.from.translate(document) as MqttPayload
    return { foreignId: `${msg.topic}:${Date.now()}` }
  }

  async simulateInbound(payload: MqttPayload, ctx: AdapterContext): Promise<void> {
    const metadata: ForeignMetadata = {
      protocol: 'mqtt',
      adapterId: this.id,
      subjectOrTopic: payload.topic,
      headers: payload.headers,
      timestampIso: new Date().toISOString(),
    }
    await ctx.onInbound(this, payload, metadata)
  }
}
