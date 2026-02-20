import { z } from "zod"

export const AiPurposeSchema = z.enum([
  "rule_generation",
  "rule_duplicate_check",
  "issue_analysis",
])

export type AiPurpose = z.infer<typeof AiPurposeSchema>
