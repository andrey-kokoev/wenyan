import type { MessageState, Transition } from '@andrey-kokoev/wenyan-core'

export const replay = (transitions: Transition[]): MessageState =>
  transitions
    .slice()
    .sort((a, b) => a.sequenceNo - b.sequenceNo)
    .reduce<MessageState>((_, t) => t.toState, 'pending')
