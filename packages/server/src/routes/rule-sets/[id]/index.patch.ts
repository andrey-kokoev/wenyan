// ============================================================================
// PATCH /api/rule-sets/:id - Update a rule set
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../../types/env"
import { ruleSets } from "../../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../../utils/workspaces"
import { validatePositiveInt } from "../../../utils/validation"

const updateRuleSetSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
})

export const middleware = zValidator("json", updateRuleSetSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const id = validatePositiveInt(c.req.param("id"))
    if (id === null) {
      return c.json({ success: false, error: "Invalid rule set ID" }, 400)
    }

    const body = await c.req.json()
    const data = updateRuleSetSchema.parse(body)

    const db = drizzle(c.env.DB)
    const existing = await db.select().from(ruleSets).where(eq(ruleSets.id, id)).get()

    if (!existing) {
      return c.json({ success: false, error: "Rule set not found" }, 404)
    }

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    const updateData: Partial<typeof ruleSets.$inferInsert> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description

    const [updated] = await db
      .update(ruleSets)
      .set(updateData)
      .where(eq(ruleSets.id, id))
      .returning({
        id: ruleSets.id,
        name: ruleSets.name,
        description: ruleSets.description,
        createdAt: ruleSets.createdAt,
        updatedAt: ruleSets.updatedAt,
      })

    return c.json({ success: true, data: updated })
  } catch (error) {
    console.error("Error updating rule set:", error)
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: "Validation error", details: error.issues },
        400,
      )
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update rule set",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
