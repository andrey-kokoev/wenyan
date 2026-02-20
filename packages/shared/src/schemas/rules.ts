import { z } from "zod"

// Rule schema - represents a reusable policy/config item (global)
// NOTE: Aligned with server database schema
export const ruleSchema = z.object({
  id: z.number().int(),
  code: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  createdBy: z.string().min(1).max(320),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})

export type Rule = z.infer<typeof ruleSchema>

// Project-Rule relationship schema
// NOTE: Aligned with server database schema
export const projectRelRuleSchema = z.object({
  id: z.number().int(),
  projectId: z.number().int(),
  ruleId: z.number().int(),
  createdAt: z.number().int(),
})

export type ProjectRelRule = z.infer<typeof projectRelRuleSchema>

// Input types for creating/updating
export interface CreateRuleInput {
  code: string
  name: string
  description?: string
}

export interface UpdateRuleInput {
  code?: string
  name?: string
  description?: string
}

export interface CreateProjectRelRuleInput {
  projectId: number
  ruleId: number
}

// Project-RuleSet relationship schema
export const projectRelRuleSetSchema = z.object({
  id: z.number().int(),
  projectId: z.number().int(),
  ruleSetId: z.number().int(),
  createdAt: z.number().int(),
})

export type ProjectRelRuleSet = z.infer<typeof projectRelRuleSetSchema>

// Rule set schema - global
export const ruleSetSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})

export type RuleSet = z.infer<typeof ruleSetSchema>

// RuleSet-Rule relationship schema
export const ruleSetRelRuleSchema = z.object({
  id: z.number().int(),
  ruleSetId: z.number().int(),
  ruleId: z.number().int(),
  createdAt: z.number().int(),
})

export type RuleSetRelRule = z.infer<typeof ruleSetRelRuleSchema>

export interface CreateRuleSetInput {
  name: string
  description?: string
}

export interface UpdateRuleSetInput {
  name?: string
  description?: string
}

export interface CreateRuleSetRelRuleInput {
  ruleSetId: number
  ruleId: number
}
