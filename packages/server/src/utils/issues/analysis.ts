import { z } from "zod"
import JSON5 from "json5"
import { jsonrepair } from "jsonrepair"
import { issueFindingResponseSchema } from "@andrey-kokoev/wenyan-shared"

export function buildPrompt(input: {
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

export function estimateTokensFromText(text: string) {
  return Math.max(1, Math.ceil(text.length / 4))
}

export function extractJson(raw: string) {
  const text = raw.trim()
  const match = text.match(/```json\\s*([\\s\\S]*?)```/i)
  const cleaned = match ? match[1].trim() : text
  const repaired = jsonrepair(cleaned)
  return JSON5.parse(repaired)
}

export function normalizeIssuePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload
  const record = payload as { issues?: unknown[] }
  if (!Array.isArray(record.issues)) return payload

  const normalizedIssues = record.issues.map((issue) => {
    if (!issue || typeof issue !== "object") return issue
    const mutable = { ...(issue as Record<string, unknown>) }
    if (typeof mutable.title === "string") {
      const trimmed = mutable.title.trim()
      mutable.title = trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed
    }
    if (typeof mutable.description === "string") {
      const trimmed = mutable.description.trim()
      mutable.description = trimmed.length > 4000 ? trimmed.slice(0, 4000) : trimmed
    }
    return mutable
  })

  return { ...record, issues: normalizedIssues }
}

export function validateIssuePayload(rawText: string) {
  const parsed = extractJson(rawText)
  const normalized = normalizeIssuePayload(parsed)
  return issueFindingResponseSchema.parse(normalized)
}

export function normalizeAnchor(
  anchor: { type?: string; text?: string | null } | undefined | null,
): { type: "quote"; text: string } | undefined {
  if (!anchor || anchor.type !== "quote" || !anchor.text) return undefined
  return { type: "quote", text: anchor.text }
}

export function stringifyZodErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path?.length ? issue.path.join(".") : "root"
      return `${path}: ${issue.message}`
    })
    .join("\n")
}
