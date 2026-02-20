// ============================================================================
// POST /api/rules/ai/duplicates - Check proposed rules for duplicates via AI
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../types/env"
import { rules } from "../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../utils/workspaces"
import { createAiProviderForPurpose } from "../../utils/ai/providers"
import { loadUserSettings } from "../../utils/userSettings"
import JSON5 from "json5"
import { jsonrepair } from "jsonrepair"

const proposedRuleSchema = z.object({
  code: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
})

const duplicatesRequestSchema = z.object({
  proposed: z.array(proposedRuleSchema).min(1).max(50),
  threshold: z.number().min(0).max(1).optional(),
})

const duplicatesResponseSchema = z.object({
  duplicates: z.array(
    z.object({
      proposedIndex: z.number().int().nonnegative(),
      matches: z.array(
        z.object({
          id: z.number().int().positive(),
          code: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          similarity: z.number().min(0).max(1),
          reason: z.string().optional(),
        }),
      ),
    }),
  ),
})

function duplicatesResponseFormatSchema() {
  return {
    type: "json_schema",
    json_schema: {
      type: "object",
      properties: {
        duplicates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              proposedIndex: { type: "integer" },
              matches: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    code: { type: "string" },
                    name: { type: "string" },
                    description: { type: ["string", "null"] },
                    similarity: { type: "number" },
                    reason: { type: "string" },
                  },
                  required: ["id", "code", "name", "similarity", "reason"],
                },
              },
            },
            required: ["proposedIndex", "matches"],
          },
        },
      },
      required: ["duplicates"],
    },
  }
}

function stripCodeFence(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^`{3,}\s*(?:json5?|json)\s*([\s\S]*?)\s*`{3,}$/i)
  return match ? match[1].trim() : text
}

function findJsonCandidate(text: string) {
  const fenced = stripCodeFence(text)
  if (fenced !== text) return fenced

  const firstObject = text.indexOf("{")
  const firstArray = text.indexOf("[")
  const starts = [firstObject, firstArray].filter((value) => value >= 0)
  if (starts.length === 0) return text
  const start = Math.min(...starts)
  const endChar = start === firstArray ? "]" : "}"
  const end = text.lastIndexOf(endChar)
  if (end <= start) return text
  return text.slice(start, end + 1)
}

function extractJson(text: string): unknown {
  const candidate = findJsonCandidate(text)
  try {
    return JSON.parse(candidate)
  } catch {
    const repaired = jsonrepair(candidate)
    return JSON5.parse(repaired)
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
    const data = duplicatesRequestSchema.parse(body)
    const db = drizzle(c.env.DB)

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    const existing = await db
      .select({
        id: rules.id,
        code: rules.code,
        name: rules.name,
        description: rules.description,
      })
      .from(rules)

    const existingText = existing
      .map(
        (rule) =>
          `- [${rule.id}] ${rule.code}: ${rule.name}${rule.description ? ` — ${rule.description}` : ""}`,
      )
      .join("\n")

    const proposedText = data.proposed
      .map(
        (rule, index) =>
          `#${index} ${rule.code}: ${rule.name}${rule.description ? ` — ${rule.description}` : ""}`,
      )
      .join("\n")

    const threshold = data.threshold ?? 0.8

    const prompt = `
You are checking for duplicate rules.
Identify proposed rules that are duplicates of existing ones at similarity >= ${threshold}.
Use a 0..1 similarity score. Only return matches that meet the threshold.
Return JSON:
{
  "duplicates": [
    {
      "proposedIndex": number,
      "matches": [
        {
          "id": number,
          "code": string,
          "name": string,
          "description": string|null,
          "similarity": number,
          "reason": string
        }
      ]
    }
  ]
}

Existing rules:
${existingText || "None"}

Proposed rules:
${proposedText}
`.trim()

    const userSettings = await loadUserSettings(c, { includeSecrets: true })
    const { provider, selection } = await createAiProviderForPurpose(
      c,
      userSettings,
      "rule_duplicate_check",
    )

    const responseFormat = selection.providerKey === "cloudflare"
      ? duplicatesResponseFormatSchema()
      : undefined

    const rawText = await provider.run({
      system: "Return strict JSON only. Do not include any prose.",
      user: prompt,
      maxTokens: selection.maxOutputTokens ?? 1200,
      temperature: 0.1,
      responseFormat,
    })

    const parsed = extractJson(rawText)
    const validated = duplicatesResponseSchema.safeParse(parsed)
    if (!validated.success) {
      return c.json(
        { success: false, error: "Invalid AI response", details: validated.error.issues },
        400,
      )
    }

    return c.json({ success: true, data: validated.data })
  } catch (error) {
    console.error("Error checking rule duplicates:", error)
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: "Validation error", details: error.issues }, 400)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check duplicates",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
