import type { BridgeAdapterConfig, MessageEnvelope } from '@andrey-kokoev/wenyan-core'
import type { AdapterContext, BridgeAdapter, ForeignMetadata, FromWenyan, IntoWenyan, TranslationResult } from '../types'

interface PayrollPayload {
  transfer_id: string
  worker_id: string
  amount: number
  transaction_hash: string
}

class PayrollIntoWenyanAdapter implements IntoWenyan<PayrollPayload> {
  constructor(private readonly config: Extract<BridgeAdapterConfig, { protocol: 'payroll' }>) {}

  translate(payload: PayrollPayload, metadata: ForeignMetadata): TranslationResult {
    return {
      ok: true,
      document: {
        id: this.extractIdempotencyKey(payload, metadata),
        genre: this.config.target_genre,
        payload: {
          worker_id: payload.worker_id,
          amount: payload.amount,
          transaction_hash: payload.transaction_hash,
        },
        actor: { id: `bridge:${this.config.id}`, role: 'bridge_adapter' },
        submittedAt: metadata.timestampIso,
        metadata: {
          idempotency_key: this.extractIdempotencyKey(payload, metadata),
          routing: { destination: 'payroll/receipt' },
          provenance: { foreign: 'payroll', trusted: this.config.trust_provenance ?? false },
        },
      },
    }
  }

  extractIdempotencyKey(payload: PayrollPayload, _metadata?: ForeignMetadata): string {
    return `payroll:${payload.transfer_id}`
  }

  async verifyProvenance(): Promise<boolean> {
    return this.config.trust_provenance ?? false
  }
}

class PayrollFromWenyanAdapter implements FromWenyan<Record<string, unknown>> {
  translate(document: MessageEnvelope): Record<string, unknown> {
    return {
      transfer_ref: document.id,
      worker_id: document.payload.worker_id,
      amount: document.payload.amount,
      masked_bank_account: '***',
    }
  }

  reconcile(local: Record<string, unknown>, remote: MessageEnvelope): Record<string, unknown> {
    return { ...local, ...remote.payload }
  }
}

export class PayrollBridgeAdapter implements BridgeAdapter {
  readonly protocol = 'payroll' as const
  readonly id: string
  readonly config: Extract<BridgeAdapterConfig, { protocol: 'payroll' }>
  readonly into: IntoWenyan<unknown>
  readonly from: FromWenyan<unknown>
  private running = false

  constructor(config: Extract<BridgeAdapterConfig, { protocol: 'payroll' }>) {
    this.id = config.id
    this.config = config
    this.into = new PayrollIntoWenyanAdapter(config) as IntoWenyan<unknown>
    this.from = new PayrollFromWenyanAdapter() as FromWenyan<unknown>
  }

  async start(_ctx: AdapterContext): Promise<void> {
    this.running = true
  }

  async stop(): Promise<void> {
    this.running = false
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    return this.running ? { ok: true, detail: 'simulated-payroll' } : { ok: false, detail: 'stopped' }
  }

  async publishOutbound(document: MessageEnvelope): Promise<{ foreignId: string }> {
    const data = this.from.translate(document) as { transfer_ref: string }
    return { foreignId: `payroll:${String(data.transfer_ref)}` }
  }
}
