// ============================================================================
// DELETE /api/projects/:id - Delete a project
// ============================================================================

import { eq } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../../types/env"
import { projects } from "../../../database/workspaces/schema"
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

    // Check if project exists
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    if (!project) {
      return c.json({ success: false, error: "Project not found" }, 404)
    }

    await db.delete(projects).where(eq(projects.id, id))

    return c.json({
      success: true,
      message: "Project deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting project:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete project",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}
