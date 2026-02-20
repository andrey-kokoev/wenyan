import { eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { appConfig } from "../database/workspaces/schema"

export type AppConfigKey =
  | "docx_conversion_url"
  | "docx_conversion_token"
  | "doc_upload_max_mb"
  | "ai_anthropic_base_url"
  | "ai_anthropic_api_key"
  | "ai_huggingface_base_url"
  | "ai_huggingface_api_key"
  | "ai_moonshot_base_url"
  | "ai_moonshot_api_key"

export interface DocxConversionConfig {
  url: string | null
  token: string | null
}

export interface DocUploadConfig {
  maxMb: number | null
}

export interface AiProviderConfig {
  anthropicBaseUrl: string | null
  anthropicApiKey: string | null
  huggingfaceBaseUrl: string | null
  huggingfaceApiKey: string | null
  moonshotBaseUrl: string | null
  moonshotApiKey: string | null
}

export async function getConfigValue(
  db: DrizzleD1Database,
  key: AppConfigKey,
): Promise<string | null> {
  const row = await db.select().from(appConfig).where(eq(appConfig.key, key)).get()
  return row?.value ?? null
}

export async function setConfigValue(
  db: DrizzleD1Database,
  key: AppConfigKey,
  value: string,
): Promise<void> {
  if (
    ![
      "docx_conversion_url",
      "docx_conversion_token",
      "doc_upload_max_mb",
      "ai_anthropic_base_url",
      "ai_anthropic_api_key",
      "ai_huggingface_base_url",
      "ai_huggingface_api_key",
      "ai_moonshot_base_url",
      "ai_moonshot_api_key",
    ].includes(key)
  ) {
    throw new Error("Invalid config key")
  }
  const existing = await db.select().from(appConfig).where(eq(appConfig.key, key)).get()
  if (existing) {
    await db
      .update(appConfig)
      .set({
        value,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(appConfig.key, key))
  } else {
    await db.insert(appConfig).values({ key, value })
  }
}

export async function getDocxConversionConfig(
  db: DrizzleD1Database,
): Promise<DocxConversionConfig> {
  const [url, token] = await Promise.all([
    getConfigValue(db, "docx_conversion_url"),
    getConfigValue(db, "docx_conversion_token"),
  ])
  return { url, token }
}

export async function getDocUploadConfig(
  db: DrizzleD1Database,
): Promise<DocUploadConfig> {
  const maxValue = await getConfigValue(db, "doc_upload_max_mb")
  const parsed = maxValue ? Number(maxValue) : NaN
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { maxMb: null }
  }
  return { maxMb: parsed }
}

export async function getAiProviderConfig(
  db: DrizzleD1Database,
): Promise<AiProviderConfig> {
  const [
    anthropicBaseUrl,
    anthropicApiKey,
    huggingfaceBaseUrl,
    huggingfaceApiKey,
    moonshotBaseUrl,
    moonshotApiKey,
  ] = await Promise.all([
    getConfigValue(db, "ai_anthropic_base_url"),
    getConfigValue(db, "ai_anthropic_api_key"),
    getConfigValue(db, "ai_huggingface_base_url"),
    getConfigValue(db, "ai_huggingface_api_key"),
    getConfigValue(db, "ai_moonshot_base_url"),
    getConfigValue(db, "ai_moonshot_api_key"),
  ])
  return {
    anthropicBaseUrl,
    anthropicApiKey,
    huggingfaceBaseUrl,
    huggingfaceApiKey,
    moonshotBaseUrl,
    moonshotApiKey,
  }
}
