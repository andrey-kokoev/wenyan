// ============================================================================
// POST /api/projects/:id/issues/analyze/:jobId/consume - Consume async analysis result
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { and, eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../../../types/env"
import { assertProjectAccess } from "../../../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../../../utils/validation"
import {
  documents,
  issues,
  issuesRelDocuments,
  issuesRelRules,
} from "../../../../../../database/workspaces/schema"
import { getEffectiveRulesForProject } from "../../../../../../utils/rules/effectiveRules"
import { fetchHttpJobResult } from "../../../../../../utils/httpJobs"
import { httpJobs } from "../../../../../../database/workspaces/schema"

import { normalizeAnchor, validateIssuePayload } from "../../../../../../utils/issues/analysis"

const consumeSchema = z.object({
  mode: z.enum(["replace_all", "replace_ai", "incremental"]).optional(),
  documentIds: z.array(z.number().int().positive()).optional(),
})

function extractAnthropicText(body: string) {
  const parsed = JSON.parse(body) as { content?: Array<{ type: string; text?: string }> }
  const text = parsed?.content?.find((item) => item.type === "text")?.text
  if (!text) {
    throw new Error("Anthropic response missing text")
  }
  return text
}

function extractHuggingFaceText(body: string) {
  const parsed = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> }
  const text = parsed?.choices?.[0]?.message?.content
  if (!text) {
    throw new Error("Hugging Face response missing text")
  }
  return text
}

function detectProviderFromRequest(requestJson?: string | null) {
  if (!requestJson) return "unknown"
  try {
    const parsed = JSON.parse(requestJson) as { url?: string }
    const url = (parsed?.url || "").toLowerCase()
    if (url.includes("api.anthropic.com") || url.includes("/v1/messages")) return "anthropic"
    if (url.includes("huggingface.co") || url.includes("/chat/completions")) return "huggingface"
    if (url.includes("moonshot.ai")) return "moonshot"
  } catch {
    return "unknown"
  }
  return "unknown"
}

export default async function handler(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  try {
    const projectId = validatePositiveInt(c.req.param("id"), "id")
    if (projectId === null) {
      return c.json({ success: false, error: "Invalid project ID" }, 400)
    }
    await assertProjectAccess(c, projectId)

    const jobId = c.req.param("jobId")?.trim()
    if (!jobId) {
      return c.json({ success: false, error: "Invalid job ID" }, 400)
    }

    const body = await c.req.json().catch(() => ({}))
    const params = consumeSchema.parse(body)
    const mode = params.mode ?? "replace_ai"

    const db = drizzle(c.env.DB)
    const job = await db
      .select({ id: httpJobs.id, projectId: httpJobs.projectId, requestJson: httpJobs.requestJson })
      .from(httpJobs)
      .where(eq(httpJobs.id, jobId))
      .get()
    if (!job || job.projectId !== projectId) {
      return c.json({ success: false, error: "Job not found" }, 404)
    }

    const consumeMarkerKey = `issue-analysis-consumed:${jobId}`
    const alreadyConsumed = await c.env.KV.get(consumeMarkerKey)
    if (alreadyConsumed) {
      return c.json({
        success: true,
        data: {
          issues: [],
          skippedCount: 0,
          alreadyConsumed: true,
        },
      })
    }

    const jobResult = await fetchHttpJobResult(c, jobId)
    if (!jobResult.body) {
      return c.json({ success: false, error: "Analysis result is empty" }, 400)
    }
    if (jobResult.httpStatus >= 400) {
      return c.json(
        {
          success: false,
          error: `Analysis request failed (HTTP ${jobResult.httpStatus})`,
          details: jobResult.body,
        },
        400,
      )
    }

    const providerFromMarker = await c.env.KV.get(`issue-analysis-provider:${jobId}`)
    const provider = providerFromMarker || detectProviderFromRequest(job.requestJson)
    let aiText = ""
    if (provider === "anthropic") {
      aiText = extractAnthropicText(jobResult.body)
    } else if (provider === "huggingface" || provider === "moonshot") {
      aiText = extractHuggingFaceText(jobResult.body)
    } else {
      throw new Error("Unsupported analysis provider in job result")
    }
    const validated = validateIssuePayload(aiText)

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

    if (mode === "replace_all") {
      await db.delete(issues).where(eq(issues.projectId, projectId))
    } else if (mode === "replace_ai") {
      await db.delete(issues).where(and(eq(issues.projectId, projectId), eq(issues.origin, "ai")))
    }

    const createdIssues = []
    const skippedIssues: Array<{
      index: number
      title?: string
      reason: string
      ruleIds?: number[]
      documentIds?: number[]
    }> = []

    for (const [index, finding] of validated.issues.entries()) {
      const validRuleIds = finding.ruleIds.filter((ruleId) =>
        rules.some((rule) => rule.id === ruleId),
      )
      const validDocumentIds = finding.documents
        .map((doc) => doc.documentId)
        .filter((docId) => filteredDocs.some((row) => row.id === docId))

      if (validRuleIds.length === 0 || validDocumentIds.length === 0) {
        skippedIssues.push({
          index,
          title: finding.title,
          reason:
            validRuleIds.length === 0 && validDocumentIds.length === 0
              ? "No valid ruleIds or documentIds"
              : validRuleIds.length === 0
                ? "No valid ruleIds"
                : "No valid documentIds",
          ruleIds: finding.ruleIds,
          documentIds: finding.documents.map((doc) => doc.documentId),
        })
        continue
      }

      const [created] = await db
        .insert(issues)
        .values({
          title: finding.title,
          description: finding.description,
          priority: finding.severity,
          status: "open",
          origin: "ai",
          projectId,
        })
        .returning()

      createdIssues.push({ ...created, ruleIds: finding.ruleIds, documents: finding.documents })

      const docLinks = finding.documents
        .filter((doc) => filteredDocs.some((row) => row.id === doc.documentId))
        .map((doc) => {
          const normalized = normalizeAnchor(doc.anchor)
          return {
            issueId: created.id,
            documentId: doc.documentId,
            anchorType: normalized?.type ?? null,
            anchorStart: null,
            anchorEnd: null,
            anchorText: normalized?.text ?? null,
          }
        })

      if (docLinks.length > 0) {
        await db.insert(issuesRelDocuments).values(docLinks)
      }

      const ruleLinks = validRuleIds.map((ruleId) => ({ issueId: created.id, ruleId }))

      if (ruleLinks.length > 0) {
        await db.insert(issuesRelRules).values(ruleLinks)
      }
    }

    if (skippedIssues.length > 0) {
      try {
        const bucket = c.env.BLOB
        if (bucket) {
          const key = `ai-errors/issues/${projectId}/${Date.now()}-${crypto.randomUUID()}.json`
          await bucket.put(
            key,
            JSON.stringify(
              {
                projectId,
                skippedCount: skippedIssues.length,
                skippedIssues,
                createdCount: createdIssues.length,
              },
              null,
              2,
            ),
            { httpMetadata: { contentType: "application/json" } },
          )
        }
      } catch (error) {
        console.error("Failed to store skipped AI issues:", error)
      }
    }

    try {
      await c.env.KV.put(consumeMarkerKey, String(Date.now()), {
        expirationTtl: 60 * 60 * 24 * 30,
      })
    } catch (error) {
      console.error("Failed to mark analysis job as consumed:", error)
    }

    return c.json({
      success: true,
      data: {
        issues: createdIssues,
        skippedCount: skippedIssues.length,
        alreadyConsumed: false,
      },
    })
  } catch (error) {
    console.error("Issue analysis consume error:", error)
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
        error: error instanceof Error ? error.message : "Failed to consume analysis results",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
