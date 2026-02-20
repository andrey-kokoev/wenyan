import { MessageEnvelopeSchema } from './ti'

export * from './ti'
export * from './kinds'

export function validateEnvelope(input: unknown) {
  return MessageEnvelopeSchema.parse(input)
}
