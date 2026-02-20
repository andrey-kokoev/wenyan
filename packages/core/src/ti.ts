import { z } from 'zod'

export const MessageStateSchema = z.enum([
  'pending',
  'validated',
  'reviewed',
  'authorized',
  'rejected',
  'archived',
])

export const ActorSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
})

export const LawSnapshotSchema = z.object({
  at: z.string().datetime(),
})

export const VectorClockSchema = z.record(z.string(), z.number().int().nonnegative())

export const ConsortEnvelopeMetaSchema = z.object({
  origin_node_id: z.string().min(1),
  vector_clock: VectorClockSchema.default({}),
  gossip_seq: z.number().int().nonnegative().default(0),
})

export const MessageEnvelopeSchema = z.object({
  id: z.string().min(1),
  genre: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  actor: ActorSchema,
  submittedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export const TiDefinitionPayloadSchema = z.object({
  target_genre: z.string().min(1),
  version: z.string().min(1),
  schema: z.record(z.string(), z.unknown()),
  superseded_by: z.string().min(1).optional(),
})

export const TiDefinitionSchema = MessageEnvelopeSchema.extend({
  genre: z.literal('ti_definition'),
  payload: TiDefinitionPayloadSchema,
})

export const TransitionSchema = z.object({
  messageId: z.string().min(1),
  fromState: MessageStateSchema,
  toState: MessageStateSchema,
  sequenceNo: z.number().int().nonnegative(),
  actorId: z.string().min(1).optional(),
  reason: z.string().optional(),
  sealedAt: z.string().datetime().optional(),
  prevTransitionHash: z.string().min(1).optional(),
  at: z.string().datetime(),
})

export type VectorClock = z.infer<typeof VectorClockSchema>
export type ConsortEnvelopeMeta = z.infer<typeof ConsortEnvelopeMetaSchema>
