import type { MessageState, Transition } from '@andrey-kokoev/wenyan-core'

export function stateAtFromTransitions(transitions: Transition[], atIso: string): MessageState {
  const candidate = transitions
    .filter((t) => (t.sealedAt ?? t.at) <= atIso)
    .sort((a, b) => b.sequenceNo - a.sequenceNo)[0]
  return candidate?.toState ?? 'pending'
}
