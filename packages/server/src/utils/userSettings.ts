// ============================================================================
// USER SETTINGS HELPERS (KV)
// ============================================================================

import type { Context } from "hono"
import type { Bindings, Variables } from "../types/env"
import {
  UserSettingsSchema,
  type UserSettings,
  type UserSettingsUpdate,
  getDefaultUserSettings,
  getKvPathForUserSettings,
} from "../schemas/user.settings.schema"

function getUserEmail(c: Context<{ Bindings: Bindings; Variables: Variables }>): string {
  const auth = c.get("auth")
  if (!auth?.user?.email) {
    throw new Error("Unauthorized")
  }
  return auth.user.email.trim().toLowerCase()
}

export function stripAiSecrets(settings: UserSettings): UserSettings {
  if (!settings.ai?.apiKeys) return settings
  const apiKeysPresent = {
    anthropic: Boolean(settings.ai.apiKeys.anthropic),
    huggingface: Boolean(settings.ai.apiKeys.huggingface),
    moonshot: Boolean(settings.ai.apiKeys.moonshot),
  }
  return {
    ...settings,
    ai: {
      ...settings.ai,
      apiKeys: {},
      apiKeysPresent,
    },
  }
}

type StringMap = Record<string, string | undefined>

function mergeStringMap(current: StringMap, patch?: StringMap): StringMap {
  const next = { ...current }
  if (!patch) return next
  for (const [key, value] of Object.entries(patch)) {
    if (value === "") {
      delete next[key]
      continue
    }
    if (value !== undefined) {
      next[key] = value
    }
  }
  return next
}

export function mergeUserSettings(
  current: UserSettings,
  patch: UserSettingsUpdate
): UserSettings {
  const { ai: aiPatch, ...restPatch } = patch
  const base = {
    ...current,
    ...restPatch,
    userId: current.userId,
  }

  const mergedAi = aiPatch
    ? {
        preferredProvider: aiPatch.preferredProvider ?? current.ai.preferredProvider,
        apiKeys: mergeStringMap(current.ai.apiKeys ?? {}, aiPatch.apiKeys),
        baseUrls: mergeStringMap(current.ai.baseUrls ?? {}, aiPatch.baseUrls),
      }
    : current.ai

  return UserSettingsSchema.parse({
    ...base,
    ai: mergedAi,
  })
}

export async function loadUserSettings(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  options?: { includeSecrets?: boolean }
): Promise<UserSettings> {
  if (!UserSettingsSchema || typeof (UserSettingsSchema as any).safeParse !== "function") {
    throw new Error("UserSettingsSchema is not available")
  }
  const email = getUserEmail(c)
  const key = getKvPathForUserSettings(email)
  if (!key) {
    throw new Error("Key for user settings is not available")
  }

  const storedSettings = await c.env.KV.get(key, "json")
  const fallback = getDefaultUserSettings(email)

  if (!storedSettings) {
    return options?.includeSecrets ? fallback : stripAiSecrets(fallback)
  }

  const validationResult = UserSettingsSchema.safeParse(storedSettings)
  const resolved = validationResult.success ? validationResult.data : fallback
  return options?.includeSecrets ? resolved : stripAiSecrets(resolved)
}

export async function saveUserSettings(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  settings: UserSettings
): Promise<void> {
  const email = getUserEmail(c)
  const key = getKvPathForUserSettings(email)
  if (!key) {
    throw new Error("Key for user settings is not available")
  }
  await c.env.KV.put(key, JSON.stringify(settings))
}
