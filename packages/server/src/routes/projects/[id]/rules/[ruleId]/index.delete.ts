// ============================================================================
// DELETE /api/projects/:id/rules/:ruleId - Unlink a rule from a project
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq, and } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../../types/env"
import { projectsRelRules } from "../../../../../database/workspaces/schema"
import { assertProjectAccess } from "../../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const projectId = validatePositiveInt(c.req.param("id"))
    const ruleId = validatePositiveInt(c.req.param("ruleId"))
    if (projectId === null || ruleId === null) {
      return c.json({ success: false, error: "Invalid project or rule ID" }, 400)
    }

    await assertProjectAccess(c, projectId)

    const db = drizzle(c.env.DB)
    await db
      .delete(projectsRelRules)
      .where(and(eq(projectsRelRules.projectId, projectId), eq(projectsRelRules.ruleId, ruleId)))

    return c.json({ success: true })
  } catch (error) {
    console.error("Error unlinking rule from project:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to unlink rule",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
