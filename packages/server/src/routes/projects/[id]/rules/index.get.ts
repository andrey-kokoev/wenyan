// ============================================================================
// GET /api/projects/:id/rules - List rules linked to a project
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../types/env"
import { projectsRelRules, rules } from "../../../../database/workspaces/schema"
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
        id: rules.id,
        name: rules.name,
        description: rules.description,
        createdAt: rules.createdAt,
        updatedAt: rules.updatedAt,
      })
      .from(projectsRelRules)
      .innerJoin(rules, eq(projectsRelRules.ruleId, rules.id))
      .where(eq(projectsRelRules.projectId, projectId))

    return c.json({ success: true, data: rows })
  } catch (error) {
    console.error("Error listing project rules:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list project rules",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
