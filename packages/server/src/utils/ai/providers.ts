// ============================================================================
// AI PROVIDERS
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq, asc, and } from "drizzle-orm"
import type { Bindings, Variables } from "../../types/env"
import { getAiProviderConfig } from "../app-config"
import type { AiProviderId, UserSettings } from "../../schemas/user.settings.schema"
import {
  aiProviders,
  aiResponders,
} from "../../database/workspaces/schema"
import type { AiPurpose } from "@wenyan/shared"

export type AiMessage = {
  system: string
  user: string
  maxTokens: number
  temperature: number
  responseFormat?: unknown
}

export interface AiProvider {
  id: AiProviderId
  run(message: AiMessage): Promise<string>
}

type ModeSettings = Record<string, unknown>
type ResponderSettings = ModeSettings & {
  contextWindowTokens?: number
}

function parseModeSettings(raw?: string | null): ModeSettings {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") {
      return parsed as ModeSettings
    }
  } catch {
    return {}
  }
  return {}
}

function parseResponderSettings(raw?: string | null): ResponderSettings {
  return parseModeSettings(raw) as ResponderSettings
}

function parseContextWindowTokens(raw?: string | null): number | null {
  const settings = parseResponderSettings(raw)
  const value = settings.contextWindowTokens
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

function normalizeModelType(value?: string | null): "chat" | "prompt" | "embedding" | undefined {
  if (value === "chat" || value === "prompt" || value === "embedding") {
    return value
  }
  return undefined
}

function createCloudflareProvider(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  modelName: string,
  modelType: "chat" | "prompt" | "embedding"
): AiProvider {
  const ai = c.env.AI
  if (!ai) {
    throw new Error("AI binding not available")
  }

  const normalizeResponse = (raw: unknown): string => {
    if (typeof raw === "string") return raw
    if (raw && typeof raw === "object") {
      const record = raw as Record<string, unknown>
      if (typeof record.text === "string") return record.text
      const message = record.message
      if (message && typeof message === "object") {
        const msg = message as Record<string, unknown>
        if (typeof msg.text === "string") return msg.text
      }
      if (Array.isArray(record.output)) {
        const parts = record.output
          .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).text : ""))
          .filter((text) => typeof text === "string" && text.length > 0)
        if (parts.length) return parts.join("\n")
      }
      if (Array.isArray(record.responses)) {
        const parts = record.responses
          .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).text : ""))
          .filter((text) => typeof text === "string" && text.length > 0)
        if (parts.length) return parts.join("\n")
      }
    }
    return JSON.stringify(raw ?? "")
  }

  return {
    id: "cloudflare",
    async run(message) {
      const payload =
        modelType === "prompt"
          ? {
              prompt: `${message.system}\n\n${message.user}`.trim(),
              max_tokens: message.maxTokens,
              temperature: message.temperature,
              ...(message.responseFormat ? { response_format: message.responseFormat } : {}),
            }
          : {
              messages: [
                { role: "system", content: message.system },
                { role: "user", content: message.user },
              ],
              max_tokens: message.maxTokens,
              temperature: message.temperature,
              ...(message.responseFormat ? { response_format: message.responseFormat } : {}),
            }

      const response = await ai.run(modelName, payload)

      return normalizeResponse(response.response)
    },
  }
}

function createAnthropicProvider(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  options: {
    apiKey: string
    model: string
    baseUrl: string
    modeSettings: ModeSettings
  }
): AiProvider {
  const apiKey = options.apiKey
  if (!apiKey) {
    throw new Error("Anthropic API key is not configured")
  }

  const model = options.model
  const baseUrl = options.baseUrl
  const modeSettings = options.modeSettings

  const isHttpJobRequest = (message: AiMessage) => {
    const metadata = message.responseFormat as Record<string, unknown> | undefined
    return metadata?.__httpJob === true
  }

  return {
    id: "anthropic",
    async run(message) {
      if (isHttpJobRequest(message)) {
        throw new Error("Anthropic async analysis should be handled by the HTTP job worker")
      }
      const payload = {
        ...modeSettings,
        model,
        max_tokens: message.maxTokens,
        temperature: message.temperature,
        system: message.system,
        messages: [{ role: "user", content: message.user }],
      }

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        const detail = errorText ? ` - ${errorText.slice(0, 500)}` : ""
        throw new Error(`Anthropic API error (HTTP ${response.status})${detail}`)
      }

      const data = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>
      }
      const text = data?.content?.find((item) => item.type === "text")?.text
      if (!text) {
        throw new Error("Anthropic API returned empty response")
      }
      return text
    },
  }
}

function createHuggingFaceProvider(
  options: {
    apiKey: string
    model: string
    baseUrl: string
    modeSettings: ModeSettings
  }
): AiProvider {
  const apiKey = options.apiKey
  if (!apiKey) {
    throw new Error("Hugging Face API key is not configured")
  }

  const model = options.model
  const baseUrl = options.baseUrl
  const modeSettings = options.modeSettings

  return {
    id: "huggingface",
    async run(message) {
      const payload = {
        ...modeSettings,
        model,
        messages: [
          { role: "system", content: message.system },
          { role: "user", content: message.user },
        ],
        max_tokens: message.maxTokens,
        temperature: message.temperature,
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        const detail = errorText ? ` - ${errorText.slice(0, 500)}` : ""
        throw new Error(`Hugging Face API error (HTTP ${response.status})${detail}`)
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const text = data?.choices?.[0]?.message?.content
      if (!text) {
        throw new Error("Hugging Face API returned empty response")
      }
      return text
    },
  }
}

function createMoonshotProvider(
  options: {
    apiKey: string
    model: string
    baseUrl: string
    modeSettings: ModeSettings
  }
): AiProvider {
  const apiKey = options.apiKey
  if (!apiKey) {
    throw new Error("Moonshot API key is not configured")
  }

  const model = options.model
  const baseUrl = options.baseUrl
  const modeSettings = options.modeSettings

  return {
    id: "moonshot",
    async run(message) {
      const payload = {
        ...modeSettings,
        model,
        messages: [
          { role: "system", content: message.system },
          { role: "user", content: message.user },
        ],
        max_tokens: message.maxTokens,
        temperature: message.temperature,
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        const detail = errorText ? ` - ${errorText.slice(0, 500)}` : ""
        throw new Error(`Moonshot API error (HTTP ${response.status})${detail}`)
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const text = data?.choices?.[0]?.message?.content
      if (!text) {
        throw new Error("Moonshot API returned empty response")
      }
      return text
    },
  }
}

type ResponderSelection = {
  purpose: AiPurpose
  providerKey: string
  modelName: string
  providerBaseUrl?: string | null
  modeSettings: ModeSettings
  maxOutputTokens?: number | null
  modelType?: "chat" | "prompt" | "embedding"
  contextWindowTokens?: number | null
}

async function resolveResponderSelection(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  purpose: AiPurpose,
  providerKey: string
): Promise<ResponderSelection> {
  const db = drizzle(c.env.DB)
  const responder = await db
    .select()
    .from(aiResponders)
    .where(and(eq(aiResponders.purpose, purpose), eq(aiResponders.providerKey, providerKey)))
    .orderBy(asc(aiResponders.sortOrder), asc(aiResponders.id))
    .get()

  if (!responder) {
    throw new Error(`No AI responder configured for ${purpose} with provider ${providerKey}`)
  }

  const providerRow = await db
    .select()
    .from(aiProviders)
    .where(eq(aiProviders.key, responder.providerKey))
    .get()

  return {
    purpose,
    providerKey: responder.providerKey,
    modelName: responder.model,
    providerBaseUrl: providerRow?.defaultBaseUrl ?? null,
    modeSettings: parseModeSettings(responder.settingsJson ?? null),
    maxOutputTokens: responder.maxOutputTokens ?? null,
    modelType: normalizeModelType(responder.modelType) ?? "chat",
    contextWindowTokens: parseContextWindowTokens(responder.settingsJson ?? null),
  }
}

export async function createAiProviderForPurpose(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  settings: UserSettings,
  purpose: AiPurpose
): Promise<{ provider: AiProvider; selection: ResponderSelection }> {
  const preferredProvider = settings.ai?.preferredProvider || "cloudflare"
  const selection = await resolveResponderSelection(c, purpose, preferredProvider)
  const provider = selection.providerKey
  const db = drizzle(c.env.DB)
  const aiConfig = await getAiProviderConfig(db)

  if (provider === "anthropic") {
    if (selection.modelType && selection.modelType !== "chat") {
      throw new Error("Anthropic provider only supports chat models")
    }
    const apiKey = settings.ai?.apiKeys?.anthropic || aiConfig.anthropicApiKey
    if (!apiKey) {
      throw new Error("Anthropic API key is not configured")
    }

    const baseUrl =
      settings.ai?.baseUrls?.anthropic ||
      aiConfig.anthropicBaseUrl ||
      selection.providerBaseUrl ||
      "https://api.anthropic.com"

    const aiProvider = createAnthropicProvider(c, {
      apiKey,
      model: selection.modelName,
      baseUrl,
      modeSettings: selection.modeSettings,
    })

    return { provider: aiProvider, selection }
  }

  if (provider === "huggingface") {
    if (selection.modelType && selection.modelType !== "chat") {
      throw new Error("Hugging Face provider only supports chat models")
    }
    const apiKey = settings.ai?.apiKeys?.huggingface || aiConfig.huggingfaceApiKey
    if (!apiKey) {
      throw new Error("Hugging Face API key is not configured")
    }

    const baseUrl =
      settings.ai?.baseUrls?.huggingface ||
      aiConfig.huggingfaceBaseUrl ||
      selection.providerBaseUrl ||
      "https://router.huggingface.co/v1"

    const aiProvider = createHuggingFaceProvider({
      apiKey,
      model: selection.modelName,
      baseUrl,
      modeSettings: selection.modeSettings,
    })

    return { provider: aiProvider, selection }
  }

  if (provider === "moonshot") {
    if (selection.modelType && selection.modelType !== "chat") {
      throw new Error("Moonshot provider only supports chat models")
    }
    const apiKey = settings.ai?.apiKeys?.moonshot || aiConfig.moonshotApiKey
    if (!apiKey) {
      throw new Error("Moonshot API key is not configured")
    }

    const baseUrl =
      settings.ai?.baseUrls?.moonshot ||
      aiConfig.moonshotBaseUrl ||
      selection.providerBaseUrl ||
      "https://api.moonshot.ai/v1"

    const aiProvider = createMoonshotProvider({
      apiKey,
      model: selection.modelName,
      baseUrl,
      modeSettings: selection.modeSettings,
    })

    return { provider: aiProvider, selection }
  }

  if (provider !== "cloudflare") {
    throw new Error(`AI provider '${provider}' is not supported`)
  }

  const modelType = selection.modelType ?? "chat"
  const aiProvider = createCloudflareProvider(c, selection.modelName, modelType)
  return { provider: aiProvider, selection }
}
