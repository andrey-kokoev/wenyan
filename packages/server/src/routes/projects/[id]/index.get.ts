// ============================================================================
// GET /api/projects/:id - Get a single project
// ============================================================================

import { eq, sql } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../../types/env"
import { documents, issues, projects, projectsRelRules } from "../../../database/workspaces/schema"
import { assertProjectAccess } from "../../../utils/workspaces"
import { validatePositiveInt } from "../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const id = validatePositiveInt(c.req.param("id"))
    if (id === null) {
      return c.json({ success: false, error: "Invalid project ID: must be a positive integer" }, 400)
    }

    // Check access
    await assertProjectAccess(c, id)

    const db = drizzle(c.env.DB)
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        workspaceId: projects.workspaceId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        documentsCount: sql<number>`(select count(*) from ${documents} where ${documents.projectId} = ${projects.id})`,
        rulesCount: sql<number>`(select count(*) from ${projectsRelRules} where ${projectsRelRules.projectId} = ${projects.id})`,
        issuesCount: sql<number>`(select count(*) from ${issues} where ${issues.projectId} = ${projects.id})`,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    if (!project) {
      return c.json({ success: false, error: "Project not found" }, 404)
    }

    return c.json({
      success: true,
      data: project,
    })
  } catch (error) {
    console.error("Error getting project:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get project",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}
