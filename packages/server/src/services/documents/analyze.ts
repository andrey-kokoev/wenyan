import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { documents } from "../../database/workspaces/schema"
import { assertProjectAccess } from "../../utils/workspaces"
import { analysisRequestSchema } from "./schemas"
import type { DocumentContext } from "./types"

export async function handleDocumentAnalyze(c: DocumentContext) {
  try {
    const documentId = parseInt(c.req.param("documentId"))
    if (isNaN(documentId)) {
      return c.json({ success: false, error: "Invalid document ID" }, 400)
    }

    const body = await c.req.json()
    const analysisData = analysisRequestSchema.parse(body)
    const requestId = c.get("requestId")

    const db = drizzle(c.env.DB)

    const [doc] = await db
      .select({ projectId: documents.projectId })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)

    if (!doc) {
      return c.json({ success: false, error: "Document not found" }, 404)
    }

    await assertProjectAccess(c, doc.projectId)

    await db.update(documents).set({ status: "processing" }).where(eq(documents.id, documentId))

    return c.json({
      success: true,
      data: {
        analysisId: `analysis-${Date.now()}`,
        documentId,
        analysisType: analysisData.analysisType,
        status: "processing",
        startedAt: new Date().toISOString(),
      },
      requestId,
    })
  } catch (error) {
    console.error("Error analyzing document:", error)
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
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze document",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}

export async function handleDocumentAnalysisResults(c: DocumentContext) {
  try {
    const documentId = parseInt(c.req.param("documentId"))
    if (isNaN(documentId)) {
      return c.json({ success: false, error: "Invalid document ID" }, 400)
    }

    const analysisId = c.req.param("analysisId")
    const requestId = c.get("requestId")

    const db = drizzle(c.env.DB)

    const [doc] = await db
      .select({ projectId: documents.projectId })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)

    if (!doc) {
      return c.json({ success: false, error: "Document not found" }, 404)
    }

    await assertProjectAccess(c, doc.projectId)

    return c.json({
      success: true,
      data: {
        analysisId,
        documentId,
        status: "completed",
        results: {
          summary: "This is a sample summary of the document analysis.",
          sentiment: {
            overall: "neutral",
            confidence: 0.75,
          },
          entities: [{ text: "Sample Company", type: "ORGANIZATION", confidence: 0.9 }],
          keywords: ["analysis", "document", "sample"],
        },
        completedAt: new Date().toISOString(),
      },
      requestId,
    })
  } catch (error) {
    console.error("Error getting analysis results:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get analysis results",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
