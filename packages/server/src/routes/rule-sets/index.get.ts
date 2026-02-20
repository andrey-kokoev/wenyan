// ============================================================================
// GET /api/rule-sets - List rule sets
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../types/env"
import { ruleSets } from "../../database/workspaces/schema"
import { getAccessibleWorkspaceIds } from "../../utils/workspaces"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const db = drizzle(c.env.DB)

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: true, data: [] })
    }

    const rows = await db.select().from(ruleSets)

    return c.json({ success: true, data: rows })
  } catch (error) {
    console.error("Error listing rule sets:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list rule sets",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
