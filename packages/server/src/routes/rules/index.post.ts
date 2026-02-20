// ============================================================================
// POST /api/rules - Create a rule
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../types/env"
import { rules } from "../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../utils/workspaces"

const createRuleSchema = z.object({
  code: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
})

export const middleware = zValidator("json", createRuleSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const auth = c.get("auth")?.user
    if (!auth) {
      return c.json({ success: false, error: "Unauthorized" }, 401)
    }
    const body = await c.req.json()
    const data = createRuleSchema.parse(body)
    const db = drizzle(c.env.DB)

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    const result = await db
      .insert(rules)
      .values({
        code: data.code,
        name: data.name,
        description: data.description,
        createdBy: auth.email,
      })
      .returning({
        id: rules.id,
        code: rules.code,
        name: rules.name,
        description: rules.description,
        createdBy: rules.createdBy,
        createdAt: rules.createdAt,
        updatedAt: rules.updatedAt,
      })

    return c.json({ success: true, data: result[0] }, 201)
  } catch (error) {
    console.error("Error creating rule:", error)
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
        error: error instanceof Error ? error.message : "Failed to create rule",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
