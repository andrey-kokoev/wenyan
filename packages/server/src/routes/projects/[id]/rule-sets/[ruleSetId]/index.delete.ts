// ============================================================================
// DELETE /api/projects/:id/rule-sets/:ruleSetId - Unlink a rule set from a project
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { and, eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../../types/env"
import { projectsRelRuleSets } from "../../../../../database/workspaces/schema"
import { assertProjectAccess } from "../../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const projectId = validatePositiveInt(c.req.param("id"))
    const ruleSetId = validatePositiveInt(c.req.param("ruleSetId"))
    if (projectId === null || ruleSetId === null) {
      return c.json({ success: false, error: "Invalid project or rule set ID" }, 400)
    }

    await assertProjectAccess(c, projectId)

    const db = drizzle(c.env.DB)
    await db
      .delete(projectsRelRuleSets)
      .where(and(eq(projectsRelRuleSets.projectId, projectId), eq(projectsRelRuleSets.ruleSetId, ruleSetId)))

    return c.json({ success: true })
  } catch (error) {
    console.error("Error unlinking rule set from project:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to unlink rule set",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
