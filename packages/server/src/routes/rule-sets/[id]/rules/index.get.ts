// ============================================================================
// GET /api/rule-sets/:id/rules - List rules linked to a rule set
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../types/env"
import { ruleSetRelRules, ruleSets, rules } from "../../../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const ruleSetId = validatePositiveInt(c.req.param("id"))
    if (ruleSetId === null) {
      return c.json({ success: false, error: "Invalid rule set ID" }, 400)
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

    const rows = await db
      .select({
        id: rules.id,
        name: rules.name,
        description: rules.description,
        createdAt: rules.createdAt,
        updatedAt: rules.updatedAt,
      })
      .from(ruleSetRelRules)
      .innerJoin(rules, eq(ruleSetRelRules.ruleId, rules.id))
      .where(eq(ruleSetRelRules.ruleSetId, ruleSetId))

    return c.json({ success: true, data: rows })
  } catch (error) {
    console.error("Error listing rule set rules:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list rule set rules",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
