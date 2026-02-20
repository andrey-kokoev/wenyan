import type { BridgeAdapterConfig, MessageEnvelope } from '@wenyan/core'
import type { AdapterContext, BridgeAdapter, ForeignMetadata, FromWenyan, IntoWenyan, TranslationResult } from '../types'

interface RegulatoryPayload {
  alert_id: string
  severity: string
  location: string
}

class RegulatoryIntoWenyanAdapter implements IntoWenyan<RegulatoryPayload> {
  constructor(private readonly config: Extract<BridgeAdapterConfig, { protocol: 'regulatory' }>) {}

  translate(payload: RegulatoryPayload, metadata: ForeignMetadata): TranslationResult {
    return {
      ok: true,
      document: {
        id: this.extractIdempotencyKey(payload, metadata),
        genre: this.config.target_genre,
        payload: {
          severity: payload.severity,
          location: payload.location,
        },
        actor: { id: `bridge:${this.config.id}`, role: 'bridge_adapter' },
        submittedAt: metadata.timestampIso,
        metadata: {
          idempotency_key: this.extractIdempotencyKey(payload, metadata),
          routing: { destination: 'regulatory/safety' },
          provenance: { foreign: 'regulatory', trusted: this.config.trust_provenance ?? false },
        },
      },
    }
  }

  extractIdempotencyKey(payload: RegulatoryPayload, _metadata?: ForeignMetadata): string {
    return `regulatory:${payload.alert_id}`
  }

  async verifyProvenance(): Promise<boolean> {
    return this.config.trust_provenance ?? false
  }
}

class RegulatoryFromWenyanAdapter implements FromWenyan<Record<string, unknown>> {
  translate(document: MessageEnvelope): Record<string, unknown> {
    return {
      alert_ref: document.id,
      severity: document.payload.severity,
      location: document.payload.location,
      readonly_mirror: true,
    }
  }

  reconcile(local: Record<string, unknown>): Record<string, unknown> {
    return local
  }
}

export class RegulatoryBridgeAdapter implements BridgeAdapter {
  readonly protocol = 'regulatory' as const
  readonly id: string
  readonly config: Extract<BridgeAdapterConfig, { protocol: 'regulatory' }>
  readonly into: IntoWenyan<unknown>
  readonly from: FromWenyan<unknown>
  private running = false

  constructor(config: Extract<BridgeAdapterConfig, { protocol: 'regulatory' }>) {
    this.id = config.id
    this.config = config
    this.into = new RegulatoryIntoWenyanAdapter(config) as IntoWenyan<unknown>
    this.from = new RegulatoryFromWenyanAdapter() as FromWenyan<unknown>
  }

  async start(_ctx: AdapterContext): Promise<void> {
    this.running = true
  }

  async stop(): Promise<void> {
    this.running = false
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    return this.running ? { ok: true, detail: 'simulated-regulatory' } : { ok: false, detail: 'stopped' }
  }

  async publishOutbound(document: MessageEnvelope): Promise<{ foreignId: string }> {
    const data = this.from.translate(document) as { alert_ref: string }
    return { foreignId: `regulatory:${String(data.alert_ref)}` }
  }
}
