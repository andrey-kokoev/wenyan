// ============================================================================
// POST /api/workspaces/:id/rules - Link a rule to a workspace
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../../../types/env"
import { rules, workspacesRelRules } from "../../../../database/workspaces/schema"
import { assertWorkspaceAccess } from "../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../utils/validation"

const linkRuleSchema = z.object({
  ruleId: z.number().int().positive(),
})

export const middleware = zValidator("json", linkRuleSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const workspaceId = validatePositiveInt(c.req.param("id"))
    if (workspaceId === null) {
      return c.json({ success: false, error: "Invalid workspace ID" }, 400)
    }

    const body = await c.req.json()
    const data = linkRuleSchema.parse(body)

    await assertWorkspaceAccess(c, workspaceId)

    const db = drizzle(c.env.DB)
    const ruleRow = await db
      .select({ id: rules.id })
      .from(rules)
      .where(eq(rules.id, data.ruleId))
      .get()

    if (!ruleRow) {
      return c.json({ success: false, error: "Rule not found" }, 404)
    }

    await db.insert(workspacesRelRules).values({
      workspaceId,
      ruleId: data.ruleId,
    })

    return c.json({ success: true }, 201)
  } catch (error) {
    console.error("Error linking rule to workspace:", error)
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: "Validation error", details: error.issues },
        400,
      )
    }
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return c.json({ success: false, error: "Rule already linked to workspace" }, 409)
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to link rule to workspace",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
