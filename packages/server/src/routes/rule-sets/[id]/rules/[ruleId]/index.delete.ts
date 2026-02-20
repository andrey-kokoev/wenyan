// ============================================================================
// DELETE /api/rule-sets/:id/rules/:ruleId - Unlink a rule from a rule set
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { and, eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../../types/env"
import { ruleSetRelRules, ruleSets } from "../../../../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const ruleSetId = validatePositiveInt(c.req.param("id"))
    const ruleId = validatePositiveInt(c.req.param("ruleId"))
    if (ruleSetId === null || ruleId === null) {
      return c.json({ success: false, error: "Invalid rule set or rule ID" }, 400)
    }

    const db = drizzle(c.env.DB)
    const ruleSetRow = await db
      .select({ id: ruleSets.id })
      .from(ruleSets)
      .where(eq(ruleSets.id, ruleSetId))
      .get()

    if (!ruleSetRow) {
      return c.json({ success: false, error: "Rule set not found" }, 404)
    }

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    await db
      .delete(ruleSetRelRules)
      .where(and(eq(ruleSetRelRules.ruleSetId, ruleSetId), eq(ruleSetRelRules.ruleId, ruleId)))

    return c.json({ success: true })
  } catch (error) {
    console.error("Error unlinking rule from rule set:", error)
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
