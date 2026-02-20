import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { documents } from "../../database/workspaces/schema"
import { assertProjectAccess } from "../../utils/workspaces"
import type { DocumentContext } from "./types"

export async function handleDocumentDelete(c: DocumentContext) {
  try {
    const documentId = parseInt(c.req.param("documentId"))
    if (isNaN(documentId)) {
      return c.json({ success: false, error: "Invalid document ID" }, 400)
    }

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

    await db.delete(documents).where(eq(documents.id, documentId))

    return c.json({
      success: true,
      message: `Document ${documentId} deleted successfully`,
      requestId,
    })
  } catch (error) {
    console.error("Error deleting document:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete document",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
