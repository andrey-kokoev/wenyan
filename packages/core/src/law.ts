import { z } from 'zod'
import { MessageEnvelopeSchema } from './ti'

export const EdictLawTypeSchema = z.enum([
  'appointment',
  'classification',
  'routing',
  'admission',
  'protocol',
  'regulation',
])

export const EdictLawTypeValues = [...EdictLawTypeSchema.options]

export const EdictPayloadSchema = z.object({
  law_type: EdictLawTypeSchema,
  target_genre: z.string().min(1).optional(),
  version: z.string().min(1),
  content: z.record(z.string(), z.unknown()),
  precedence: z.number().int().default(0),
  effective_date: z.string().datetime(),
  superseded_edict_id: z.string().min(1).optional(),
})

export const EdictSchema = MessageEnvelopeSchema.extend({
  genre: z.literal('edict'),
  payload: EdictPayloadSchema,
})

export const AppointmentRoleRuleSchema = z.object({
  permissions: z.array(z.string()).default([]),
  allowed_genres: z.array(z.string()).default([]),
  max_pending: z.number().int().nonnegative().optional(),
})

export const AppointmentLawContentSchema = z.object({
  roles: z.record(z.string(), AppointmentRoleRuleSchema),
})

export const ClassificationLawContentSchema = z.object({
  levels: z.array(z.string()).min(1),
  hierarchy: z.enum(['strict', 'flat']).default('strict'),
  compartmentalization: z.boolean().default(false),
})

export const RoutingLawContentSchema = z.object({
  table: z.record(z.string(), z.array(z.string())),
  broadcast_policy: z.string().default('hierarchical'),
})

export const AdmissionLawContentSchema = z.object({
  allowed_genres: z.array(z.string()).default([]),
})

export const ProtocolLawContentSchema = z.object({
  required_acks_by_genre: z.record(z.string(), z.number().int().positive()).default({}),
})

export const RegulationLawContentSchema = z.object({
  retention_days: z.number().int().positive().optional(),
  rate_limits: z.record(z.string(), z.number().int().positive()).optional(),
})

export const LawModeSchema = z.enum(['strict'])

export interface ResolvedLaw {
  messageId: string
  lawType: z.infer<typeof EdictLawTypeSchema>
  version: string
  content: Record<string, unknown>
  precedence: number
  effectiveDate: string
  sealedAt: string
}

export type EdictLawType = z.infer<typeof EdictLawTypeSchema>
export type EdictPayload = z.infer<typeof EdictPayloadSchema>
export type Edict = z.infer<typeof EdictSchema>
export type AppointmentLawContent = z.infer<typeof AppointmentLawContentSchema>
export type ClassificationLawContent = z.infer<typeof ClassificationLawContentSchema>
export type RoutingLawContent = z.infer<typeof RoutingLawContentSchema>
export type AdmissionLawContent = z.infer<typeof AdmissionLawContentSchema>
export type ProtocolLawContent = z.infer<typeof ProtocolLawContentSchema>
export type RegulationLawContent = z.infer<typeof RegulationLawContentSchema>
export type LawMode = z.infer<typeof LawModeSchema>

export function validateEdict(input: unknown) {
  return EdictSchema.parse(input)
}
