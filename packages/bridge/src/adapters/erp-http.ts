import type { BridgeAdapterConfig, MessageEnvelope } from '@andrey-kokoev/wenyan-core'
import type { AdapterContext, BridgeAdapter, ForeignMetadata, FromWenyan, IntoWenyan, TranslationResult } from '../types'

interface ErpPayload {
  purchase_order_id: string
  material_spec: string
  quantity: number
  vendor_id: string
}

class ErpIntoWenyanAdapter implements IntoWenyan<ErpPayload> {
  constructor(private readonly config: Extract<BridgeAdapterConfig, { protocol: 'erp' }>) {}

  translate(payload: ErpPayload, metadata: ForeignMetadata): TranslationResult {
    return {
      ok: true,
      document: {
        id: this.extractIdempotencyKey(payload, metadata),
        genre: this.config.target_genre,
        payload: {
          material_spec: payload.material_spec,
          quantity: payload.quantity,
          vendor_id: payload.vendor_id,
        },
        actor: { id: `bridge:${this.config.id}`, role: 'bridge_adapter' },
        submittedAt: metadata.timestampIso,
        metadata: {
          idempotency_key: this.extractIdempotencyKey(payload, metadata),
          routing: { destination: 'erp/purchase-order' },
          provenance: { foreign: 'erp', trusted: this.config.trust_provenance ?? false },
        },
      },
    }
  }

  extractIdempotencyKey(payload: ErpPayload, _metadata?: ForeignMetadata): string {
    return `erp:${payload.purchase_order_id}`
  }

  async verifyProvenance(): Promise<boolean> {
    return this.config.trust_provenance ?? false
  }
}

class ErpFromWenyanAdapter implements FromWenyan<Record<string, unknown>> {
  translate(document: MessageEnvelope): Record<string, unknown> {
    return {
      po_ref: document.id,
      material_spec: document.payload.material_spec,
      quantity: document.payload.quantity,
      vendor_id: document.payload.vendor_id,
      tier_masked: true,
    }
  }

  reconcile(local: Record<string, unknown>, remote: MessageEnvelope): Record<string, unknown> {
    return { ...local, ...remote.payload }
  }
}

export class ErpBridgeAdapter implements BridgeAdapter {
  readonly protocol = 'erp' as const
  readonly id: string
  readonly config: Extract<BridgeAdapterConfig, { protocol: 'erp' }>
  readonly into: IntoWenyan<unknown>
  readonly from: FromWenyan<unknown>
  private running = false

  constructor(config: Extract<BridgeAdapterConfig, { protocol: 'erp' }>) {
    this.id = config.id
    this.config = config
    this.into = new ErpIntoWenyanAdapter(config) as IntoWenyan<unknown>
    this.from = new ErpFromWenyanAdapter() as FromWenyan<unknown>
  }

  async start(_ctx: AdapterContext): Promise<void> {
    this.running = true
  }

  async stop(): Promise<void> {
    this.running = false
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    return this.running ? { ok: true, detail: 'simulated-erp' } : { ok: false, detail: 'stopped' }
  }

  async publishOutbound(document: MessageEnvelope): Promise<{ foreignId: string }> {
    const data = this.from.translate(document) as { po_ref: string }
    return { foreignId: `erp:${String(data.po_ref)}` }
  }
}
