// ============================================================================
// DELETE /api/workspaces/:id/rules/:ruleId - Unlink a rule from a workspace
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { and, eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../../types/env"
import { workspacesRelRules } from "../../../../../database/workspaces/schema"
import { assertWorkspaceAccess } from "../../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const workspaceId = validatePositiveInt(c.req.param("id"))
    const ruleId = validatePositiveInt(c.req.param("ruleId"))
    if (workspaceId === null || ruleId === null) {
      return c.json({ success: false, error: "Invalid workspace or rule ID" }, 400)
    }

    await assertWorkspaceAccess(c, workspaceId)

    const db = drizzle(c.env.DB)
    await db
      .delete(workspacesRelRules)
      .where(and(eq(workspacesRelRules.workspaceId, workspaceId), eq(workspacesRelRules.ruleId, ruleId)))

    return c.json({ success: true })
  } catch (error) {
    console.error("Error unlinking rule from workspace:", error)
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
