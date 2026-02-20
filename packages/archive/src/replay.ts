import type { MessageState, Transition } from '@wenyan/core'

export const replay = (transitions: Transition[]): MessageState =>
  transitions
    .slice()
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .reduce<MessageState>((_, t) => t.toState, 'pending')
