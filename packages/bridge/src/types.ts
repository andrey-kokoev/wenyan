import type { ArchiveRepository } from '@andrey-kokoev/wenyan-archive'
import type { BridgeAdapterConfig, BridgeProtocol, MessageEnvelope } from '@andrey-kokoev/wenyan-core'

export interface ForeignMetadata {
  protocol: BridgeProtocol
  adapterId: string
  subjectOrTopic: string
  headers: Record<string, string>
  publisherId?: string
  timestampIso: string
}

export interface TranslationError {
  code: string
  message: string
}

export type TranslationResult =
  | { ok: true; document: MessageEnvelope }
  | { ok: false; error: TranslationError }

export interface IntoWenyan<T> {
  translate(payload: T, metadata: ForeignMetadata): TranslationResult
  extractIdempotencyKey(payload: T, metadata: ForeignMetadata): string
  verifyProvenance(payload: T, metadata: ForeignMetadata): Promise<boolean>
}

export interface FromWenyan<T> {
  translate(document: MessageEnvelope): T
  reconcile(local: T, remote: MessageEnvelope): T
}

export interface AdapterContext {
  archive: ArchiveRepository
  onInbound: (adapter: BridgeAdapter, payload: unknown, metadata: ForeignMetadata) => Promise<void>
}

export interface BridgeAdapter {
  readonly id: string
  readonly protocol: BridgeProtocol
  readonly config: BridgeAdapterConfig
  readonly into: IntoWenyan<unknown>
  readonly from: FromWenyan<unknown>
  start(ctx: AdapterContext): Promise<void>
  stop(): Promise<void>
  health(): Promise<{ ok: boolean; detail?: string }>
  publishOutbound(document: MessageEnvelope): Promise<{ foreignId: string }>
}

export interface BridgeMetrics {
  bridge_foreign_bytes_in: number
  bridge_wenyan_bytes_archived: number
  bridge_information_loss_ratio: number
}
