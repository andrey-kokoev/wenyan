import { z } from "zod"
import { AiPurposeSchema } from "./purposes"

export const AiResponderSchema = z.object({
  id: z.number().int(),
  purpose: AiPurposeSchema,
  providerKey: z.string().min(1),
  model: z.string().min(1),
  modelType: z.enum(["chat", "prompt", "embedding"]),
  maxOutputTokens: z.number().int().positive().nullable(),
  settingsJson: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
})

export const AiResponderListResponseSchema = z.object({
  data: z.array(AiResponderSchema),
})

export type AiResponder = z.infer<typeof AiResponderSchema>
export type AiResponderListResponse = z.infer<typeof AiResponderListResponseSchema>
