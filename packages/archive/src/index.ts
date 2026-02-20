import {
  canTransition,
  EdictLawTypeValues,
  type EdictLawType,
  type MessageEnvelope,
  type MessageState,
  type ResolvedLaw,
  type Transition,
} from '@wenyan/core'
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
  getCurrentLaw(lawType: EdictLawType, atIso: string): ResolvedLaw | undefined | Promise<ResolvedLaw | undefined>
  getLawSet(atIso: string): Record<EdictLawType, ResolvedLaw | undefined> | Promise<Record<EdictLawType, ResolvedLaw | undefined>>
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
    const defsAll = Array.from(this.messages.values())
      .filter((m) => m.genre === 'ti_definition')
      .map((m) => ({
        messageId: m.id,
        submittedAt: m.submittedAt,
        payload: m.payload as Record<string, unknown>,
      }))
      .filter((p) => p.payload.target_genre === targetGenre && this.snapshotState(p.messageId) === 'archived')
    const defs = defsAll
      .filter(
        (p) =>
          !defsAll.some((other) => {
            const payload = other.payload as Record<string, unknown>
            return payload.target_genre === targetGenre && payload.superseded_by === p.messageId
          }),
      )
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    const latest = defs.at(-1)?.payload
    if (!latest || typeof latest.schema !== 'object' || latest.schema === null) return undefined
    return latest.schema as Record<string, unknown>
  }

  getCurrentLaw(lawType: EdictLawType, atIso: string): ResolvedLaw | undefined {
    const edictsAll = Array.from(this.messages.values())
      .filter((m) => m.genre === 'edict')
      .map((m) => {
        const payload = m.payload as Record<string, unknown>
        const transitions = this.getTransitions(m.id)
        const archivedTransition = [...transitions].reverse().find((t) => t.toState === 'archived')
        return {
          messageId: m.id,
          lawType: payload.law_type,
          version: payload.version,
          content: payload.content,
          precedence: Number(payload.precedence ?? 0),
          effectiveDate: String(payload.effective_date ?? ''),
          superseded: payload.superseded_edict_id ? String(payload.superseded_edict_id) : undefined,
          sealedAt: archivedTransition?.sealedAt ?? archivedTransition?.at,
        }
      })
      .filter((e) => e.lawType === lawType)
      .filter((e) => !!e.sealedAt && e.effectiveDate <= atIso)
    const edicts = edictsAll
      .filter((e) => !edictsAll.some((s) => s.lawType === lawType && s.superseded === e.messageId && s.effectiveDate <= atIso && !!s.sealedAt))
      .sort((a, b) => {
        if (a.precedence !== b.precedence) return b.precedence - a.precedence
        if (a.effectiveDate !== b.effectiveDate) return b.effectiveDate.localeCompare(a.effectiveDate)
        if ((a.sealedAt ?? '') !== (b.sealedAt ?? '')) return (b.sealedAt ?? '').localeCompare(a.sealedAt ?? '')
        return b.messageId.localeCompare(a.messageId)
      })

    if (edicts.length === 0) return undefined
    if (edicts.length > 1) {
      const first = edicts[0]
      const second = edicts[1]
      if (
        first.precedence === second.precedence &&
        first.effectiveDate === second.effectiveDate &&
        first.sealedAt === second.sealedAt
      ) {
        throw new Error('ambiguous-law')
      }
    }

    const top = edicts[0]
    if (!top || !top.sealedAt) return undefined
    return {
      messageId: top.messageId,
      lawType: top.lawType as EdictLawType,
      version: String(top.version ?? ''),
      content: (top.content ?? {}) as Record<string, unknown>,
      precedence: top.precedence,
      effectiveDate: top.effectiveDate,
      sealedAt: top.sealedAt,
    }
  }

  getLawSet(atIso: string): Record<EdictLawType, ResolvedLaw | undefined> {
    const out = {} as Record<EdictLawType, ResolvedLaw | undefined>
    for (const lawType of EdictLawTypeValues) {
      out[lawType] = this.getCurrentLaw(lawType, atIso)
    }
    return out
  }
}

export * from './query'
export * from './replay'
