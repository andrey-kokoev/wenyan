import { Hono } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../../types/env"
import { requirePermission } from "../../../middleware/auth"
import { docxConversionConfigUpdateSchema } from "@andrey-kokoev/wenyan-shared"
import {
  getAiProviderConfig,
  getDocUploadConfig,
  getDocxConversionConfig,
  setConfigValue,
} from "../../../utils/app-config"

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
app.use("*", requirePermission("configure_application"))

const updateSchema = docxConversionConfigUpdateSchema

app.get("/", async (c) => {
  const db = drizzle(c.env.DB)
  const config = await getDocxConversionConfig(db)
  const uploadConfig = await getDocUploadConfig(db)
  const aiConfig = await getAiProviderConfig(db)
  return c.json({
    data: {
      docxConversionUrl: config.url,
      docxConversionToken: config.token ? "********" : null,
      docUploadMaxMb: uploadConfig.maxMb,
      anthropicBaseUrl: aiConfig.anthropicBaseUrl,
      anthropicApiKey: aiConfig.anthropicApiKey ? "********" : null,
      huggingfaceBaseUrl: aiConfig.huggingfaceBaseUrl,
      huggingfaceApiKey: aiConfig.huggingfaceApiKey ? "********" : null,
      moonshotBaseUrl: aiConfig.moonshotBaseUrl,
      moonshotApiKey: aiConfig.moonshotApiKey ? "********" : null,
    },
  })
})

app.patch("/", async (c) => {
  try {
    const body = updateSchema.parse(await c.req.json())
    const db = drizzle(c.env.DB)

    if (body.docxConversionUrl !== undefined && body.docxConversionUrl !== null) {
      await setConfigValue(db, "docx_conversion_url", body.docxConversionUrl)
    }

    if (body.docxConversionToken !== undefined && body.docxConversionToken !== null) {
      await setConfigValue(db, "docx_conversion_token", body.docxConversionToken)
    }
    if (body.docUploadMaxMb !== undefined && body.docUploadMaxMb !== null) {
      await setConfigValue(db, "doc_upload_max_mb", String(body.docUploadMaxMb))
    }
    if (body.anthropicBaseUrl !== undefined && body.anthropicBaseUrl !== null) {
      await setConfigValue(db, "ai_anthropic_base_url", body.anthropicBaseUrl)
    }
    if (body.anthropicApiKey !== undefined && body.anthropicApiKey !== null) {
      await setConfigValue(db, "ai_anthropic_api_key", body.anthropicApiKey)
    }
    if (body.huggingfaceBaseUrl !== undefined && body.huggingfaceBaseUrl !== null) {
      await setConfigValue(db, "ai_huggingface_base_url", body.huggingfaceBaseUrl)
    }
    if (body.huggingfaceApiKey !== undefined && body.huggingfaceApiKey !== null) {
      await setConfigValue(db, "ai_huggingface_api_key", body.huggingfaceApiKey)
    }
    if (body.moonshotBaseUrl !== undefined && body.moonshotBaseUrl !== null) {
      await setConfigValue(db, "ai_moonshot_base_url", body.moonshotBaseUrl)
    }
    if (body.moonshotApiKey !== undefined && body.moonshotApiKey !== null) {
      await setConfigValue(db, "ai_moonshot_api_key", body.moonshotApiKey)
    }

    const config = await getDocxConversionConfig(db)
    const uploadConfig = await getDocUploadConfig(db)
    const aiConfig = await getAiProviderConfig(db)
    return c.json({
      success: true,
      data: {
        docxConversionUrl: config.url,
        docxConversionToken: config.token ? "********" : null,
        docUploadMaxMb: uploadConfig.maxMb,
        anthropicBaseUrl: aiConfig.anthropicBaseUrl,
        anthropicApiKey: aiConfig.anthropicApiKey ? "********" : null,
        huggingfaceBaseUrl: aiConfig.huggingfaceBaseUrl,
        huggingfaceApiKey: aiConfig.huggingfaceApiKey ? "********" : null,
        moonshotBaseUrl: aiConfig.moonshotBaseUrl,
        moonshotApiKey: aiConfig.moonshotApiKey ? "********" : null,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return c.json({ error: "Validation error" }, 400)
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to update config" },
      400,
    )
  }
})

export default app
