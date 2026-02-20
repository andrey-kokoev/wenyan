// ============================================================================
// POST /api/rules/ai - Create rules from AI prompt
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { inArray } from "drizzle-orm"
import type { Bindings, Variables } from "../../types/env"
import { rules } from "../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../utils/workspaces"
import { createAiProviderForPurpose } from "../../utils/ai/providers"
import { loadUserSettings } from "../../utils/userSettings"

const aiRuleRequestSchema = z.object({
  prompt: z.string().min(3).max(4000),
  referenceRuleIds: z.array(z.number().int().positive()).optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
})

const aiRuleResponseSchema = z.object({
  rules: z.array(
    z.object({
      code: z.string().min(1).max(120),
      name: z.string().min(1).max(120),
      description: z.string().max(2000).optional(),
    }),
  ),
})

function ruleResponseFormatSchema() {
  return {
    type: "json_schema",
    json_schema: {
      type: "object",
      properties: {
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
            },
            required: ["code", "name"],
          },
        },
      },
      required: ["rules"],
    },
  }
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("No JSON object found in response")
    return JSON.parse(match[0])
  }
}

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const auth = c.get("auth")?.user
    if (!auth) {
      return c.json({ success: false, error: "Unauthorized" }, 401)
    }

    const body = await c.req.json().catch(() => ({}))
    const data = aiRuleRequestSchema.parse(body)
    const db = drizzle(c.env.DB)

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    const referenceRules = data.referenceRuleIds?.length
      ? await db
        .select({
          id: rules.id,
          code: rules.code,
          name: rules.name,
          description: rules.description,
        })
        .from(rules)
        .where(inArray(rules.id, data.referenceRuleIds))
      : []

    const referenceText = referenceRules.length
      ? referenceRules
        .map(
          (rule) =>
            `- ${rule.code}: ${rule.name}${rule.description ? ` — ${rule.description}` : ""}`,
        )
        .join("\n")
      : "None"

    const prompt = `
You are a policy rule writer. Create rules based on the user request.
Return ONLY valid JSON with this shape:
{
  "rules": [
    { "code": "snake_case_code", "name": "Rule name", "description": "Optional description" }
  ]
}

User request:
${data.prompt}

Referenced rules:
${referenceText}

Rules must be concise, distinct, and ready to use.
`.trim()

    const userSettings = await loadUserSettings(c, { includeSecrets: true })
    const { provider, selection } = await createAiProviderForPurpose(
      c,
      userSettings,
      "rule_generation",
    )

    const responseFormat = selection.providerKey === "cloudflare"
      ? ruleResponseFormatSchema()
      : undefined

    const rawText = await provider.run({
      system: "Return strict JSON only. Do not include any prose.",
      user: prompt,
      maxTokens: data.maxTokens ?? selection.maxOutputTokens ?? 1200,
      temperature: data.temperature ?? 0.2,
      responseFormat,
    })

    const parsed = extractJson(rawText)
    const validated = aiRuleResponseSchema.safeParse(parsed)
    if (!validated.success) {
      return c.json(
        { success: false, error: "Invalid AI response", details: validated.error.issues },
        400,
      )
    }

    return c.json({ success: true, data: { rules: validated.data.rules } }, 200)
  } catch (error) {
    console.error("Error creating rules with AI:", error)
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: "Validation error", details: error.issues }, 400)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create rule with AI",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
