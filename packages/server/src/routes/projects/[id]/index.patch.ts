// ============================================================================
// PATCH /api/projects/:id - Update a project
// ============================================================================

import { z } from "zod"
import { eq, sql } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../../types/env"
import { documents, issues, projects, projectsRelRules } from "../../../database/workspaces/schema"
import { assertProjectAccess } from "../../../utils/workspaces"
import { validatePositiveInt } from "../../../utils/validation"

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
})

export const middleware = zValidator("json", updateProjectSchema)

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

    const body = await c.req.json()
    const data = updateProjectSchema.parse(body)
    const db = drizzle(c.env.DB)

    // Build update object
    const updateData: Partial<typeof projects.$inferInsert> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description

    if (Object.keys(updateData).length === 0) {
      return c.json({
        success: false,
        error: "At least one field must be provided for updating (name or description)"
      }, 400)
    }

    const result = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning({ id: projects.id })

    if (result.length === 0 || !result[0]?.id) {
      return c.json({ success: false, error: "Project not found" }, 404)
    }

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
    console.error("Error updating project:", error)
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: "Validation error",
        details: error.issues,
      }, 400)
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update project",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}
