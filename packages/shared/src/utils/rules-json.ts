import JSON5 from 'json5'
import { jsonrepair } from 'jsonrepair'
import { z } from 'zod'
import type { CreateRuleInput } from '../schemas/rules'

const ruleSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
})

const rulesArraySchema = z.array(ruleSchema)

export type ParseRulesFromJsonResult =
  | { success: true; data: CreateRuleInput[] }
  | { success: false; message: string }

function stripCodeFence(raw: string) {
  const trimmed = raw.trim()
  const match = trimmed.match(/^`{3,}\s*(?:json5?|json)\s*([\s\S]*?)\s*`{3,}$/i)
  return match ? match[1].trim() : raw
}

export function parseRulesFromJsonInput(raw: string): ParseRulesFromJsonResult {
  let parsed: unknown
  try {
    const normalized = stripCodeFence(raw)
    const repaired = jsonrepair(normalized)
    parsed = JSON5.parse(repaired)
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to parse JSON',
    }
  }

  const items = Array.isArray(parsed) ? parsed : [parsed]
  const result = rulesArraySchema.safeParse(items)
  if (!result.success) {
    return {
      success: false,
      message: result.error.issues[0]?.message || 'Invalid rule schema',
    }
  }

  return { success: true, data: result.data }
}
