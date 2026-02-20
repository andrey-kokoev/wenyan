// ============================================================================
// POST /api/rule-sets/:id/rules - Link a rule to a rule set
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../../../types/env"
import { ruleSetRelRules, ruleSets, rules } from "../../../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../utils/validation"

const linkRuleSchema = z.object({
  ruleId: z.number().int().positive(),
})

export const middleware = zValidator("json", linkRuleSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const ruleSetId = validatePositiveInt(c.req.param("id"))
    if (ruleSetId === null) {
      return c.json({ success: false, error: "Invalid rule set ID" }, 400)
    }

    const body = await c.req.json()
    const data = linkRuleSchema.parse(body)

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

    const ruleRow = await db
      .select({ id: rules.id })
      .from(rules)
      .where(eq(rules.id, data.ruleId))
      .get()

    if (!ruleRow) {
      return c.json({ success: false, error: "Rule not found" }, 404)
    }

    await db.insert(ruleSetRelRules).values({
      ruleSetId,
      ruleId: data.ruleId,
    })

    return c.json({ success: true }, 201)
  } catch (error) {
    console.error("Error linking rule to rule set:", error)
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: "Validation error", details: error.issues },
        400,
      )
    }
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return c.json({ success: false, error: "Rule already linked to rule set" }, 409)
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to link rule",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
