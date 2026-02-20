// ============================================================================
// GET /api/projects - List all accessible projects
// Can filter by workspace_id
// ============================================================================

import { eq, inArray, sql } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../types/env"
import { documents, issues, projects, projectsRelRules } from "../../database/workspaces/schema"
import { getUserEmail, getAccessibleWorkspaceIds, assertWorkspaceAccess } from "../../utils/workspaces"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const email = getUserEmail(c)
    const workspaceIdParam = c.req.query("workspace_id")

    // Validate and parse workspace_id if provided
    let workspaceId: number | null = null
    if (workspaceIdParam) {
      const parsed = parseInt(workspaceIdParam)
      if (isNaN(parsed) || parsed <= 0) {
        return c.json({
          success: false,
          error: "Invalid workspace_id parameter. Must be a positive integer."
        }, 400)
      }
      workspaceId = parsed
    }

    const db = drizzle(c.env.DB)

    const selectFields = {
      id: projects.id,
      name: projects.name,
      description: projects.description,
      workspaceId: projects.workspaceId,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      documentsCount: sql<number>`(select count(*) from ${documents} where ${documents.projectId} = ${projects.id})`,
      rulesCount: sql<number>`(select count(*) from ${projectsRelRules} where ${projectsRelRules.projectId} = ${projects.id})`,
      issuesCount: sql<number>`(select count(*) from ${issues} where ${issues.projectId} = ${projects.id})`,
    }

    // If workspace_id is specified, check access
    if (workspaceId !== null) {
      await assertWorkspaceAccess(c, workspaceId)

      const rows = await db
        .select(selectFields)
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId))

      return c.json({
        success: true,
        data: rows,
      })
    }

    // Otherwise, get projects from all accessible workspaces
    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(c, email)

    if (accessibleWorkspaceIds.length === 0) {
      return c.json({
        success: true,
        data: [],
      })
    }

    const rows = await db
      .select(selectFields)
      .from(projects)
      .where(inArray(projects.workspaceId, accessibleWorkspaceIds))

    return c.json({
      success: true,
      data: rows,
    })
  } catch (error) {
    console.error("Error listing projects:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list projects",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}
