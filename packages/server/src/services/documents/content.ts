import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { documents } from "../../database/workspaces/schema"
import { assertProjectAccess } from "../../utils/workspaces"
import type { DocumentContext } from "./types"

export async function handleDocumentContent(c: DocumentContext) {
  try {
    const documentId = parseInt(c.req.param("documentId"))
    if (isNaN(documentId)) {
      return c.json({ success: false, error: "Invalid document ID" }, 400)
    }

    const db = drizzle(c.env.DB)
    const [doc] = await db
      .select({
        id: documents.id,
        projectId: documents.projectId,
        filename: documents.filename,
        fileType: documents.fileType,
        content: documents.content,
        status: documents.status,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1)

    if (!doc) {
      return c.json({ success: false, error: "Document not found" }, 404)
    }

    await assertProjectAccess(c, doc.projectId)

    return c.json({ success: true, data: doc })
  } catch (error) {
    console.error("Error getting document:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get document",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
