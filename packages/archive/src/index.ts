import type { EdictLawType, MessageEnvelope, MessageState, ResolvedLaw, Transition } from '@wenyan/core'
import type { SealRecord } from '@wenyan/seal'

export interface DocketItem {
  id: string
  messageId: string
  attempts: number
  availableAt: string
}

export interface IdempotencyRecord {
  key: string
  responseJson: string
  expiresAt: string
}

export interface TiDefinitionRecord {
  messageId: string
  targetGenre: string
  version: string
  schema: Record<string, unknown>
  sealedAt: string
}

export interface ConstitutionalDocumentRef {
  id: string
  archivedAt: string
}

export interface MerkleProof {
  messageId: string
  leafHash: string
  rootHash: string
  path: string[]
}

export interface GossipLogEntry {
  messageId: string
  peerNodeId: string
  sealSeq: number
  receivedAt: string
  kind: 'eager' | 'lazy' | 'repair' | 'imperial'
}

export interface ForeignSyncStateRecord {
  documentId: string
  adapterId: string
  adapterProtocol: 'nats' | 'kafka' | 'mqtt'
  foreignId: string
  foreignVectorClockJson?: string
  lastSyncAt: string
  conflictStatus: 'resolved' | 'pending' | 'schism'
  lastError?: string
}

export interface ForeignRejectedRecord {
  adapterId: string
  foreignId?: string
  reasonCode: string
  reasonDetail?: string
  payloadJson?: string
  receivedAt: string
}

export interface BridgeOutboundQueueItem {
  id: number
  adapterId: string
  messageId: string
  attempts: number
  availableAt: string
  lastError?: string
  status: 'queued' | 'sending' | 'failed' | 'sent'
}

export interface ArchiveRepository {
  appendMessage(message: MessageEnvelope): void | Promise<void>
  appendTransition(transition: Transition): void | Promise<void>
  appendSeal(seal: SealRecord): void | Promise<void>
  enqueueDocket(messageId: string): void | Promise<void>
  dequeueDocket(nowIso: string): DocketItem | undefined | Promise<DocketItem | undefined>
  snapshotState(messageId: string): MessageState | undefined | Promise<MessageState | undefined>
  getMessage(messageId: string): MessageEnvelope | undefined | Promise<MessageEnvelope | undefined>
  getTransitions(messageId: string): Transition[] | Promise<Transition[]>
  getSeals(messageId: string): SealRecord[] | Promise<SealRecord[]>
  getIdempotency(key: string, nowIso: string): IdempotencyRecord | undefined | Promise<IdempotencyRecord | undefined>
  putIdempotency(key: string, responseJson: string, expiresAt: string): void | Promise<void>
  addOfficeApproval(messageId: string, office: string): number | Promise<number>
  getOfficeApprovals(messageId: string): string[] | Promise<string[]>
  stateAt(messageId: string, timestampIso: string): MessageState | undefined | Promise<MessageState | undefined>
  getActiveGenreSchema(targetGenre: string): Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>
  getCurrentTiDefinition(genre: string, atIso?: string): TiDefinitionRecord | undefined | Promise<TiDefinitionRecord | undefined>
  getCurrentLaw(lawType: EdictLawType, atIso: string): ResolvedLaw | undefined | Promise<ResolvedLaw | undefined>
  getLawSet(atIso: string): Record<EdictLawType, ResolvedLaw | undefined> | Promise<Record<EdictLawType, ResolvedLaw | undefined>>
  getConstitutionalDocuments(): ConstitutionalDocumentRef[] | Promise<ConstitutionalDocumentRef[]>
  getMerkleRoot(scope?: 'all' | 'constitutional' | 'legislative'): string | Promise<string>
  getMerkleProof(messageId: string): MerkleProof | undefined | Promise<MerkleProof | undefined>
  getSyncRange(fromCursor: string, limit: number): Transition[] | Promise<Transition[]>
  upsertContentBlob(hash: string, payload: Uint8Array | string): void | Promise<void>
  getContentBlob(hash: string): Uint8Array | undefined | Promise<Uint8Array | undefined>
  appendGossipLog(entry: GossipLogEntry): void | Promise<void>
  appendForeignRejected(entry: ForeignRejectedRecord): void | Promise<void>
  upsertForeignSyncState(entry: ForeignSyncStateRecord): void | Promise<void>
  getForeignSyncState(documentId: string): ForeignSyncStateRecord | undefined | Promise<ForeignSyncStateRecord | undefined>
  enqueueBridgeOutbound(adapterId: string, messageId: string, availableAt: string): void | Promise<void>
  dequeueBridgeOutbound(nowIso: string, limit: number): BridgeOutboundQueueItem[] | Promise<BridgeOutboundQueueItem[]>
  markBridgeOutboundResult(id: number, status: BridgeOutboundQueueItem['status'], lastError?: string): void | Promise<void>
}

export * from './query'
export * from './replay'
export * from './ti-resolver'
export * from './merkle-dag'
export * from './sync'
