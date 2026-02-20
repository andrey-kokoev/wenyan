/**
 * User settings schemas and types
 * Shared between frontend and backend
 */

import { z } from "zod"

export const ThemeModeValues = ["light", "dark", "system"] as const
export type ThemeMode = (typeof ThemeModeValues)[number]

export type AiProviderId = string

const AiSettingsUpdateSchema = z.object({
  preferredProvider: z.string().min(1).optional(),
  apiKeys: z
    .object({
      anthropic: z.string().optional(),
      huggingface: z.string().optional(),
      moonshot: z.string().optional(),
    })
    .optional(),
  baseUrls: z
    .object({
      anthropic: z.string().optional(),
      huggingface: z.string().optional(),
      moonshot: z.string().optional(),
    })
    .optional(),
})

const AiSettingsSchema = z
  .object({
    preferredProvider: z.string().min(1).default("cloudflare"),
    apiKeys: z
      .object({
        anthropic: z.string().min(1).optional(),
        huggingface: z.string().min(1).optional(),
        moonshot: z.string().min(1).optional(),
      })
      .default({}),
    apiKeysPresent: z
      .object({
        anthropic: z.boolean().optional(),
        huggingface: z.boolean().optional(),
        moonshot: z.boolean().optional(),
      })
      .default({}),
    baseUrls: z
      .object({
        anthropic: z.string().min(1).optional(),
        huggingface: z.string().min(1).optional(),
        moonshot: z.string().min(1).optional(),
      })
      .default({}),
  })
  .default({
    preferredProvider: "cloudflare",
    apiKeys: {},
    apiKeysPresent: {},
    baseUrls: {},
  })

const UserSettingsSchemaBase = z.object({
  userId: z.string().min(1),
  themeMode: z.enum(ThemeModeValues).default("system"),
  themeId: z.string().min(1).default("default"),
  ai: AiSettingsSchema,
  lastStudioId: z.number().int().positive().optional(),
  scheduleDisplay: z
    .object({
      dayStartHour: z.number().min(0).max(23),
      dayEndHour: z.number().min(0).max(23),
    })
    .default({
      dayStartHour: 5,
      dayEndHour: 23,
    })
    .refine((data) => data.dayStartHour < data.dayEndHour, {
      message: "dayStartHour must be less than dayEndHour",
    }),
})

export const UserSettingsSchema = z.preprocess((input) => {
  if (!input || typeof input !== "object") return input
  const data = { ...(input as Record<string, unknown>) }
  if (typeof data.theme === "string" && data.themeMode === undefined) {
    data.themeMode = data.theme
    delete data.theme
  }
  if (data.ai && typeof data.ai === "object") {
    const ai = data.ai as Record<string, unknown>
    if (ai.preferredProvider === undefined && typeof ai.provider === "string") {
      ai.preferredProvider = ai.provider
    }
    if ("provider" in ai) {
      delete ai.provider
    }
    if ("modelId" in ai) {
      delete ai.modelId
    }
    if ("modeId" in ai) {
      delete ai.modeId
    }
    if ("models" in ai) {
      delete ai.models
    }
  }
  if (data.themeId === undefined) {
    data.themeId = "default"
  }
  return data
}, UserSettingsSchemaBase)

export const UserSettingsUpdateSchema = UserSettingsSchemaBase.omit({
  userId: true,
}).extend({
  ai: AiSettingsUpdateSchema.optional(),
}).partial()

export type UserSettings = z.infer<typeof UserSettingsSchema>
export type AiSettings = z.infer<typeof AiSettingsSchema>
export type AiSettingsUpdate = z.infer<typeof AiSettingsUpdateSchema>
export type UserSettingsUpdate = z.infer<typeof UserSettingsUpdateSchema>

export const getDefaultUserSettings = (userId: string): UserSettings => {
  return UserSettingsSchema.parse({
    userId,
  })
}

export const validateSettingsUpdate = (data: unknown) => {
  return UserSettingsUpdateSchema.safeParse(data)
}

export const createUserSettings = (
  userId: string,
  data: z.infer<typeof UserSettingsUpdateSchema>,
): UserSettings => {
  return UserSettingsSchema.parse({
    ...data,
    userId,
  })
}

export const getKvPathForUserSettings = (userId: string): string | undefined =>
  userId ? `user:settings:${userId}` : undefined
