import { z } from 'zod'

export const Seal0ReceiptSchema = z.object({
  id: z.string().min(1),
  document_id: z.string().min(1).nullable(),
  actor_id: z.string().min(1),
  genre: z.string().min(1).optional(),
  query_timestamp: z.string().datetime(),
  query_parameters_hash: z.string().min(1),
  result_hash: z.string().min(1),
  result_status: z.enum(['allowed', 'denied']),
  reason: z.string().min(1).optional(),
  signature: z.string().min(1),
  trace_id: z.string().min(1).optional(),
  node_id: z.string().min(1).optional(),
})

export const AuditQuerySchema = z.object({
  documentId: z.string().min(1).optional(),
  genre: z.string().min(1).optional(),
  since: z.string().datetime().optional(),
})

export const AnomalySeveritySchema = z.enum(['info', 'warning', 'critical'])

export const AnomalyRuleSchema = z.object({
  type: z.enum([
    'velocity',
    'temporal_anomaly',
    'geographic_impossibility',
    'coalition',
    'ghost_worker',
    'material_diversion',
    'schedule_impossible',
    'structural_cabal',
  ]),
  threshold: z.number().positive(),
  windowSeconds: z.number().int().positive().default(60),
  enabled: z.boolean().default(true),
})

export const AnomalyAlertSchema = z.object({
  id: z.string().min(1),
  alert_type: z.string().min(1),
  severity: AnomalySeveritySchema,
  actor_id: z.string().min(1).optional(),
  node_id: z.string().min(1).optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  action_taken: z.string().min(1).optional(),
})

export const CensorateRuntimeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  otlp_endpoint: z.string().url().optional(),
  seal0_required: z.boolean().default(true),
  seal0_retention_days: z.number().int().positive().default(365),
  anomaly_detection: z.boolean().default(true),
  sampling: z
    .object({
      constitutional: z.number().min(0).max(1).default(1),
      legislative: z.number().min(0).max(1).default(0.5),
      telemetry: z.number().min(0).max(1).default(0.1),
    })
    .default({
      constitutional: 1,
      legislative: 0.5,
      telemetry: 0.1,
    }),
})

export type Seal0Receipt = z.infer<typeof Seal0ReceiptSchema>
export type AuditQuery = z.infer<typeof AuditQuerySchema>
export type AnomalyRule = z.infer<typeof AnomalyRuleSchema>
export type AnomalyAlert = z.infer<typeof AnomalyAlertSchema>
export type AnomalySeverity = z.infer<typeof AnomalySeveritySchema>
export type CensorateRuntimeConfig = z.infer<typeof CensorateRuntimeConfigSchema>
