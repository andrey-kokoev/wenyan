// ============================================================================
// POST /api/rule-sets - Create a rule set
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../types/env"
import { ruleSets } from "../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../utils/workspaces"

const createRuleSetSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
})

export const middleware = zValidator("json", createRuleSetSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const body = await c.req.json()
    const data = createRuleSetSchema.parse(body)

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    const db = drizzle(c.env.DB)
    const [created] = await db
      .insert(ruleSets)
      .values({
        name: data.name,
        description: data.description ?? null,
      })
      .returning({
        id: ruleSets.id,
        name: ruleSets.name,
        description: ruleSets.description,
        createdAt: ruleSets.createdAt,
        updatedAt: ruleSets.updatedAt,
      })

    return c.json({ success: true, data: created }, 201)
  } catch (error) {
    console.error("Error creating rule set:", error)
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
        error: error instanceof Error ? error.message : "Failed to create rule set",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
