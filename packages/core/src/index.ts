import { MessageEnvelopeSchema, TiDefinitionSchema } from './ti'

/** @public Frozen in v1.x */
export * from './ti'
/** @public Frozen in v1.x */
export * from './kinds'
/** @public Frozen in v1.x */
export * from './law'
/** @public Frozen in v1.x */
export * from './bootstrap'
/** @experimental May change before v2.0 */
export * from './censorate'

/** @public Frozen in v1.x */
export function validateEnvelope(input: unknown) {
  return MessageEnvelopeSchema.parse(input)
}

/** @public Frozen in v1.x */
export function validateTiDefinition(input: unknown) {
  return TiDefinitionSchema.parse(input)
}
