// ============================================================================
// GET /api/rules/:id - Get a single rule
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../types/env"
import { rules } from "../../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../../utils/workspaces"
import { validatePositiveInt } from "../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const id = validatePositiveInt(c.req.param("id"))
    if (id === null) {
      return c.json({ success: false, error: "Invalid rule ID" }, 400)
    }

    const db = drizzle(c.env.DB)
    const row = await db.select().from(rules).where(eq(rules.id, id)).get()

    if (!row) {
      return c.json({ success: false, error: "Rule not found" }, 404)
    }

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    return c.json({ success: true, data: row })
  } catch (error) {
    console.error("Error fetching rule:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch rule",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
