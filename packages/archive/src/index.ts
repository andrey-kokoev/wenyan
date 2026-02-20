import { canTransition, type MessageEnvelope, type MessageState, type Transition } from '@wenyan/core'
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
}

export class InMemoryArchiveRepository implements ArchiveRepository {
  private messages = new Map<string, MessageEnvelope>()
  private transitions = new Map<string, Transition[]>()
  private seals = new Map<string, SealRecord[]>()
  private docket: DocketItem[] = []
  private idempotency = new Map<string, IdempotencyRecord>()
  private approvals = new Map<string, Set<string>>()

  appendMessage(message: MessageEnvelope): void {
    this.messages.set(message.id, message)
  }

  appendTransition(transition: Transition): void {
    const current = this.snapshotState(transition.messageId) ?? 'pending'
    if (!canTransition(current, transition.toState) && current !== transition.fromState) {
      throw new Error(`Invalid transition ${current} -> ${transition.toState}`)
    }
    const list = this.transitions.get(transition.messageId) ?? []
    if (list.some((t) => t.toState === transition.toState && t.sequenceNo === transition.sequenceNo)) {
      throw new Error('Duplicate transition sequence')
    }
    list.push(transition)
    this.transitions.set(transition.messageId, list)
  }

  appendSeal(seal: SealRecord): void {
    const list = this.seals.get(seal.messageId) ?? []
    list.push(seal)
    this.seals.set(seal.messageId, list)
  }

  enqueueDocket(messageId: string): void {
    this.docket.push({
      id: `${messageId}:${Date.now()}`,
      messageId,
      attempts: 0,
      availableAt: new Date().toISOString(),
    })
  }

  dequeueDocket(nowIso: string): DocketItem | undefined {
    const idx = this.docket.findIndex((d) => d.availableAt <= nowIso)
    if (idx < 0) {
      return undefined
    }
    return this.docket.splice(idx, 1)[0]
  }

  snapshotState(messageId: string): MessageState | undefined {
    const list = this.transitions.get(messageId)
    if (!list || list.length === 0) {
      return undefined
    }
    return list[list.length - 1].toState
  }

  getMessage(messageId: string): MessageEnvelope | undefined {
    return this.messages.get(messageId)
  }

  getTransitions(messageId: string): Transition[] {
    return this.transitions.get(messageId) ?? []
  }

  getSeals(messageId: string): SealRecord[] {
    return this.seals.get(messageId) ?? []
  }

  getIdempotency(key: string, nowIso: string): IdempotencyRecord | undefined {
    const record = this.idempotency.get(key)
    if (!record) return undefined
    if (record.expiresAt < nowIso) return undefined
    return record
  }

  putIdempotency(key: string, responseJson: string, expiresAt: string): void {
    this.idempotency.set(key, { key, responseJson, expiresAt })
  }

  addOfficeApproval(messageId: string, office: string): number {
    const set = this.approvals.get(messageId) ?? new Set<string>()
    set.add(office)
    this.approvals.set(messageId, set)
    return set.size
  }

  getOfficeApprovals(messageId: string): string[] {
    return Array.from(this.approvals.get(messageId) ?? new Set<string>())
  }

  stateAt(messageId: string, timestampIso: string): MessageState | undefined {
    const transitions = (this.transitions.get(messageId) ?? [])
      .filter((t) => (t.sealedAt ?? t.at) <= timestampIso)
      .sort((a, b) => b.sequenceNo - a.sequenceNo)
    return transitions[0]?.toState
  }

  getActiveGenreSchema(targetGenre: string): Record<string, unknown> | undefined {
    const defs = Array.from(this.messages.values())
      .filter((m) => m.genre === 'ti_definition')
      .map((m) => m.payload as Record<string, unknown>)
      .filter((p) => p.target_genre === targetGenre && !p.superseded_by)
    const latest = defs.at(-1)
    if (!latest || typeof latest.schema !== 'object' || latest.schema === null) return undefined
    return latest.schema as Record<string, unknown>
  }
}

export * from './query'
export * from './replay'
