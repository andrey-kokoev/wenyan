// ============================================================================
// GET /api/projects/:id/rule-sets - List rule sets linked to a project
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../types/env"
import { projectsRelRuleSets, ruleSets } from "../../../../database/workspaces/schema"
import { assertProjectAccess } from "../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const projectId = validatePositiveInt(c.req.param("id"))
    if (projectId === null) {
      return c.json({ success: false, error: "Invalid project ID" }, 400)
    }

    await assertProjectAccess(c, projectId)

    const db = drizzle(c.env.DB)
    const rows = await db
      .select({
        id: ruleSets.id,
        name: ruleSets.name,
        description: ruleSets.description,
        createdAt: ruleSets.createdAt,
        updatedAt: ruleSets.updatedAt,
      })
      .from(projectsRelRuleSets)
      .innerJoin(ruleSets, eq(projectsRelRuleSets.ruleSetId, ruleSets.id))
      .where(eq(projectsRelRuleSets.projectId, projectId))

    return c.json({ success: true, data: rows })
  } catch (error) {
    console.error("Error listing project rule sets:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list project rule sets",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
