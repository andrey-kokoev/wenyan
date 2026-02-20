import type { z } from 'zod'
import { LawSnapshotSchema, MessageEnvelopeSchema, MessageStateSchema, TransitionSchema } from './ti'

export type MessageState = z.infer<typeof MessageStateSchema>
export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>
export type Transition = z.infer<typeof TransitionSchema>
export type LawSnapshot = z.infer<typeof LawSnapshotSchema>

export const AllowedTransitions: Record<MessageState, MessageState[]> = {
  pending: ['validated', 'authorized', 'rejected'],
  validated: ['reviewed', 'rejected'],
  reviewed: ['pending', 'authorized', 'rejected'],
  authorized: ['archived'],
  rejected: [],
  archived: [],
}

export function canTransition(fromState: MessageState, toState: MessageState): boolean {
  return AllowedTransitions[fromState].includes(toState)
}
