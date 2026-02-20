import { z } from "zod"

export const AiAvailableProviderSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
})

export const AiAvailableProvidersResponseSchema = z.object({
  data: z.array(AiAvailableProviderSchema),
})

export type AiAvailableProvider = z.infer<typeof AiAvailableProviderSchema>
export type AiAvailableProvidersResponse = z.infer<typeof AiAvailableProvidersResponseSchema>
