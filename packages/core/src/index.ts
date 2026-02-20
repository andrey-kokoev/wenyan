import { MessageEnvelopeSchema, TiDefinitionSchema } from './ti'

export * from './ti'
export * from './kinds'

export function validateEnvelope(input: unknown) {
  return MessageEnvelopeSchema.parse(input)
}

export function validateTiDefinition(input: unknown) {
  return TiDefinitionSchema.parse(input)
}
