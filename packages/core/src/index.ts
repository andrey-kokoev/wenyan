import { MessageEnvelopeSchema, TiDefinitionSchema } from './ti'

export * from './ti'
export * from './kinds'
export * from './law'
export * from './bootstrap'

export function validateEnvelope(input: unknown) {
  return MessageEnvelopeSchema.parse(input)
}

export function validateTiDefinition(input: unknown) {
  return TiDefinitionSchema.parse(input)
}
