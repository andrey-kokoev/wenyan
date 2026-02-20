// ============================================================================
// PATCH /api/rules/:id - Update a rule
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../../types/env"
import { rules } from "../../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../../utils/workspaces"
import { validatePositiveInt } from "../../../utils/validation"

const updateRuleSchema = z
  .object({
    code: z.string().min(1).max(120).optional(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
  })
  .refine(
    (data) =>
      data.code !== undefined || data.name !== undefined || data.description !== undefined,
    {
    message: "At least one field is required",
    },
  )

export const middleware = zValidator("json", updateRuleSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const id = validatePositiveInt(c.req.param("id"), "id")
    if (id === null) {
      return c.json({ success: false, error: "Invalid rule ID" }, 400)
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch (err) {
      console.error("Invalid JSON body:", err)
      return c.json({ success: false, error: "Invalid JSON body" }, 400)
    }
    const data = updateRuleSchema.parse(body)
    const db = drizzle(c.env.DB)

    const existing = await db.select().from(rules).where(eq(rules.id, id)).get()
    if (!existing) {
      return c.json({ success: false, error: "Rule not found" }, 404)
    }

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    const updateData: Partial<typeof rules.$inferInsert> = {}
    if (data.code !== undefined) updateData.code = data.code
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description

    const result = await db
      .update(rules)
      .set(updateData)
      .where(eq(rules.id, id))
      .returning({
        id: rules.id,
        code: rules.code,
        name: rules.name,
        description: rules.description,
        createdBy: rules.createdBy,
        createdAt: rules.createdAt,
        updatedAt: rules.updatedAt,
      })

    return c.json({ success: true, data: result[0] })
  } catch (error) {
    console.error("Error updating rule:", error)
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
        error: error instanceof Error ? error.message : "Failed to update rule",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
