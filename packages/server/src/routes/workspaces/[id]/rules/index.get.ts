// ============================================================================
// GET /api/workspaces/:id/rules - List rules linked to a workspace
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../types/env"
import { rules, workspacesRelRules } from "../../../../database/workspaces/schema"
import { assertWorkspaceAccess } from "../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const workspaceId = validatePositiveInt(c.req.param("id"))
    if (workspaceId === null) {
      return c.json({ success: false, error: "Invalid workspace ID" }, 400)
    }

    await assertWorkspaceAccess(c, workspaceId)

    const db = drizzle(c.env.DB)
    const rows = await db
      .select({
        id: rules.id,
        code: rules.code,
        name: rules.name,
        description: rules.description,
        createdAt: rules.createdAt,
        updatedAt: rules.updatedAt,
      })
      .from(workspacesRelRules)
      .innerJoin(rules, eq(workspacesRelRules.ruleId, rules.id))
      .where(eq(workspacesRelRules.workspaceId, workspaceId))

    return c.json({ success: true, data: rows })
  } catch (error) {
    console.error("Error listing workspace rules:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list workspace rules",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
