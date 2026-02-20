import { drizzle } from "drizzle-orm/d1"
import { eq, inArray } from "drizzle-orm"
import { documents } from "../../database/workspaces/schema"
import { getAccessibleProjectIds } from "../../utils/workspaces"
import type { DocumentContext } from "./types"

export async function handleDocumentList(c: DocumentContext) {
  try {
    const requestId = c.get("requestId")
    const projectIdParam = c.req.query("project_id")
    const projectId = projectIdParam ? parseInt(projectIdParam) : null

    const db = drizzle(c.env.DB)

    const accessibleProjectIds = await getAccessibleProjectIds(c)

    if (accessibleProjectIds.length === 0) {
      return c.json({
        success: true,
        data: [],
        total: 0,
        requestId,
      })
    }

    if (projectId !== null && !isNaN(projectId)) {
      if (!accessibleProjectIds.includes(projectId)) {
        return c.json({ success: false, error: "Forbidden" }, 403)
      }

      const rows = await db
        .select({
          id: documents.id,
          projectId: documents.projectId,
          filename: documents.filename,
          fileType: documents.fileType,
          status: documents.status,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .where(eq(documents.projectId, projectId))

      return c.json({
        success: true,
        data: rows,
        total: rows.length,
        requestId,
      })
    }

    const rows = await db
      .select({
        id: documents.id,
        projectId: documents.projectId,
        filename: documents.filename,
        fileType: documents.fileType,
        status: documents.status,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(inArray(documents.projectId, accessibleProjectIds))

    return c.json({
      success: true,
      data: rows,
      total: rows.length,
      requestId,
    })
  } catch (error) {
    console.error("Error listing documents:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list documents",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
