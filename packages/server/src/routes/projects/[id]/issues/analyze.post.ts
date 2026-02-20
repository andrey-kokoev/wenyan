// ============================================================================
// POST /api/projects/:id/issues/analyze - Analyze documents with effective rules
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../types/env"
import { assertProjectAccess } from "../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../utils/validation"
import { documents, issues } from "../../../../database/workspaces/schema"
import { getEffectiveRulesForProject } from "../../../../utils/rules/effectiveRules"
import { createAiProviderForPurpose } from "../../../../utils/ai/providers"
import { getAiProviderConfig } from "../../../../utils/app-config"
import { loadUserSettings } from "../../../../utils/userSettings"
import { enqueueHttpJob } from "../../../../utils/httpJobs"

function getRequesterEmail(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  const auth = c.get("auth")
  const email = auth?.user?.email
  if (!email) {
    throw new Error("Unauthorized")
  }
  return email.trim().toLowerCase()
}

const analyzeIssuesSchema = z.object({
  documentIds: z.array(z.number().int().positive()).optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
  mode: z.enum(["replace_all", "replace_ai", "incremental"]).optional(),
  effort: z.enum(["sample", "low", "medium", "high", "extra_high"]).optional(),
})

function buildPrompt(input: {
  rules: Array<{ id: number; name: string; description?: string | null }>
  documents: Array<{ id: number; filename: string; content: string | null }>
  existingIssues?: Array<{ title: string; description: string | null }>
}) {
  const rulesText = input.rules
    .map(
      (rule) => `Rule ${rule.id}: ${rule.name}${rule.description ? ` — ${rule.description}` : ""}`,
    )
    .join("\n")

  const existingText = (input.existingIssues || [])
    .map((issue) => `- ${issue.title}${issue.description ? ` — ${issue.description}` : ""}`)
    .join("\n")

  const docsText = input.documents
    .map((doc) => `Document ${doc.id} (${doc.filename}):\n${doc.content ?? ""}`)
    .join("\n\n---\n\n")

  return `
You are a compliance analyst. Identify issues by applying the rules to the documents.
Be comprehensive and return as many issues as you can find, without repeating existing ones.
Only return NEW issues that are not already listed below.

Rules:
${rulesText}

Existing issues (do not repeat):
${existingText || "None"}

Documents:
${docsText}

Return ONLY valid JSON in this format.
Use ONLY quote anchors: anchor.type must be "quote" and include anchor.text with an exact snippet from the document.
Do NOT use line/span anchors.
Keep title <= 200 characters and description <= 4000 characters.
documentId values MUST be one of the numeric IDs listed in the Documents section.
{
  "issues": [
    {
      "title": "Short title",
      "description": "Clear description",
      "severity": "low|medium|high|critical",
      "confidence": 0.0-1.0,
      "ruleIds": [1, 2],
      "documents": [
        {
          "documentId": 123,
          "anchor": {
            "type": "quote",
            "text": "exact quoted snippet"
          }
        }
      ],
      "evidence": ["optional supporting note"]
    }
  ]
}
`.trim()
}

function estimateTokensFromText(text: string) {
  return Math.max(1, Math.ceil(text.length / 4))
}

const analysisSystemPrompt =
  "You are a compliance analyst that returns strict JSON only. Do not include prose outside JSON."

function getProviderRequestConfig(input: {
  providerKey: string
  selection: { modeSettings: Record<string, unknown>; modelName: string; providerBaseUrl?: string | null }
  userSettings: { ai?: { baseUrls?: Record<string, string | undefined>; apiKeys?: Record<string, string | undefined> } }
  aiConfig: {
    anthropicBaseUrl: string | null
    anthropicApiKey: string | null
    huggingfaceBaseUrl: string | null
    huggingfaceApiKey: string | null
    moonshotBaseUrl: string | null
    moonshotApiKey: string | null
  }
  finalMaxTokens: number
  temperature: number
  prompt: string
}):
  | { ok: true; url: string; headers: Record<string, string>; requestPayload: Record<string, unknown> }
  | { ok: false; error: string } {
  const { providerKey, selection, userSettings, aiConfig, finalMaxTokens, temperature, prompt } = input
  if (providerKey === "anthropic") {
    const baseUrl =
      userSettings.ai?.baseUrls?.anthropic ||
      aiConfig.anthropicBaseUrl ||
      selection.providerBaseUrl ||
      "https://api.anthropic.com"
    const apiKey = userSettings.ai?.apiKeys?.anthropic || aiConfig.anthropicApiKey
    if (!apiKey) {
      return { ok: false as const, error: "Anthropic API key is not configured." }
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }
    return {
      ok: true as const,
      url: `${baseUrl.replace(/\/$/, "")}/v1/messages`,
      headers,
      requestPayload: {
        ...selection.modeSettings,
        model: selection.modelName,
        max_tokens: finalMaxTokens,
        temperature,
        system: analysisSystemPrompt,
        messages: [{ role: "user", content: prompt }],
      },
    }
  }
  if (providerKey === "huggingface") {
    const baseUrl =
      userSettings.ai?.baseUrls?.huggingface ||
      aiConfig.huggingfaceBaseUrl ||
      selection.providerBaseUrl ||
      "https://router.huggingface.co/v1"
    const apiKey = userSettings.ai?.apiKeys?.huggingface || aiConfig.huggingfaceApiKey
    if (!apiKey) {
      return { ok: false as const, error: "Hugging Face API key is not configured." }
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }
    return {
      ok: true as const,
      url: `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      headers,
      requestPayload: {
        ...selection.modeSettings,
        model: selection.modelName,
        max_tokens: finalMaxTokens,
        temperature,
        messages: [
          { role: "system", content: analysisSystemPrompt },
          { role: "user", content: prompt },
        ],
      },
    }
  }
  if (providerKey === "moonshot") {
    const baseUrl =
      userSettings.ai?.baseUrls?.moonshot ||
      aiConfig.moonshotBaseUrl ||
      selection.providerBaseUrl ||
      "https://api.moonshot.ai/v1"
    const apiKey = userSettings.ai?.apiKeys?.moonshot || aiConfig.moonshotApiKey
    if (!apiKey) {
      return { ok: false as const, error: "Moonshot API key is not configured." }
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }
    return {
      ok: true as const,
      url: `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      headers,
      requestPayload: {
        ...selection.modeSettings,
        model: selection.modelName,
        max_tokens: finalMaxTokens,
        temperature,
        messages: [
          { role: "system", content: analysisSystemPrompt },
          { role: "user", content: prompt },
        ],
      },
    }
  }
  return {
    ok: false as const,
    error: `Async analysis is not configured for provider '${providerKey}'.`,
  }
}

export default async function handler(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  try {
    console.info("Issue analysis start", { requestId: c.get("requestId") })
    const projectId = validatePositiveInt(c.req.param("id"), "id")
    if (projectId === null) {
      return c.json({ success: false, error: "Invalid project ID" }, 400)
    }
    console.info("Issue analysis project resolved", { projectId })

    await assertProjectAccess(c, projectId)
    console.info("Issue analysis access ok", { projectId })

    const body = await c.req.json().catch(() => ({}))
    let params: z.infer<typeof analyzeIssuesSchema>
    try {
      params = analyzeIssuesSchema.parse(body)
    } catch (parseError) {
      console.error("Analyze request parse error:", parseError, { body })
      throw parseError
    }
    console.info("Issue analysis params parsed", { params })
    const mode = params.mode ?? "replace_ai"

    const db = drizzle(c.env.DB)
    const docRows = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        content: documents.content,
        projectId: documents.projectId,
      })
      .from(documents)
      .where(eq(documents.projectId, projectId))

    const filteredDocs = params.documentIds?.length
      ? docRows.filter((doc) => params.documentIds?.includes(doc.id))
      : docRows

    if (filteredDocs.length === 0) {
      return c.json({ success: false, error: "No documents available for analysis" }, 400)
    }

    const rules = await getEffectiveRulesForProject(c, projectId)
    if (rules.length === 0) {
      return c.json({ success: false, error: "No rules available for analysis" }, 400)
    }

    const existingIssues =
      mode === "incremental"
        ? await db
            .select({ title: issues.title, description: issues.description })
            .from(issues)
            .where(eq(issues.projectId, projectId))
        : []

    let userSettings
    try {
      userSettings = await loadUserSettings(c, { includeSecrets: true })
    } catch (error) {
      console.error("Issue analysis failed to load user settings", error)
      throw error
    }
    console.info("Issue analysis loaded user settings", {
      hasSettings: Boolean(userSettings),
      hasAi: Boolean(userSettings?.ai),
      preferredProvider: userSettings?.ai?.preferredProvider,
    })

    let selection
    try {
      ;({ selection } = await createAiProviderForPurpose(c, userSettings, "issue_analysis"))
    } catch (error) {
      console.error("Issue analysis failed to resolve provider", error)
      throw error
    }
    const aiConfig = await getAiProviderConfig(db)
    console.info("Issue analysis provider selected", { providerKey: selection?.providerKey })
    const prompt = buildPrompt({ rules, documents: filteredDocs, existingIssues })

    const effort = params.effort ?? "medium"
    const providerMax = selection.maxOutputTokens ?? 1800
    const effortFactors = {
      sample: 0.25,
      low: 0.4,
      medium: 0.5,
      high: 0.75,
      extra_high: 1,
    }
    const desiredTokens = Math.round(providerMax * effortFactors[effort])
    const computedMaxTokens = Math.min(desiredTokens, providerMax)
    const estimatedInputTokens = estimateTokensFromText(prompt)
    const contextWindow = selection.contextWindowTokens ?? null
    const contextSlack = 1000
    const effectiveContextWindow =
      contextWindow && contextWindow > contextSlack ? contextWindow - contextSlack : contextWindow
    const availableOutputTokens =
      effectiveContextWindow && effectiveContextWindow > 0
        ? Math.max(0, effectiveContextWindow - estimatedInputTokens)
        : null
    const cappedMaxTokens =
      availableOutputTokens !== null
        ? Math.min(computedMaxTokens, Math.max(300, availableOutputTokens))
        : computedMaxTokens
    if (availableOutputTokens !== null && availableOutputTokens < 300) {
      return c.json(
        {
          success: false,
          error:
            "Input too large for the model context window. Reduce documents or rules and try again.",
        },
        400,
      )
    }
    const requestedMaxTokens = params.maxTokens ?? cappedMaxTokens
    const finalMaxTokens =
      availableOutputTokens !== null
        ? Math.min(requestedMaxTokens, Math.max(300, availableOutputTokens))
        : requestedMaxTokens
    const providerRequest = getProviderRequestConfig({
      providerKey: selection.providerKey,
      selection,
      userSettings,
      aiConfig,
      finalMaxTokens,
      temperature: params.temperature ?? 0.2,
      prompt,
    })
    if (!providerRequest.ok) {
      return c.json(
        {
          success: false,
          error: providerRequest.error,
        },
        400,
      )
    }

    let jobId: string
    try {
      jobId = await enqueueHttpJob(
        c,
        {
          method: "POST",
          url: providerRequest.url,
          headers: providerRequest.headers,
          body: JSON.stringify(providerRequest.requestPayload),
          timeoutSeconds: 300,
          responseMaxBytes: 2_000_000,
        },
        {
          projectId,
          requestedBy: getRequesterEmail(c),
        },
      )
    } catch (error) {
      console.error("Issue analysis enqueue failed", error)
      throw error
    }
    try {
      await c.env.KV.put(`issue-analysis-provider:${jobId}`, selection.providerKey, {
        expirationTtl: 60 * 60 * 24 * 30,
      })
    } catch (error) {
      console.error("Issue analysis failed to persist provider marker", error)
    }
    console.info("Issue analysis job enqueued", { jobId })

    const responseData: Record<string, unknown> = {
      jobId,
      status: "queued",
    }

    if (c.env.ENVIRONMENT === "development") {
      responseData.sent_request = {
        provider: selection.providerKey,
        model: selection.modelName,
        modelType: selection.modelType ?? "chat",
        maxTokens: finalMaxTokens,
        temperature: params.temperature ?? 0.2,
        system: analysisSystemPrompt,
        user: prompt,
      }
    }

    return c.json({ success: true, data: responseData }, 202)
  } catch (error) {
    console.error("Issue analysis error:", error)
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation error",
          details: error.issues,
        },
        400,
      )
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze issues",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
