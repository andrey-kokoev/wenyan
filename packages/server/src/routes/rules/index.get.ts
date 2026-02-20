// ============================================================================
// GET /api/rules - List rules
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../types/env"
import { rules } from "../../database/workspaces/schema"
import { getAccessibleWorkspaceIds, assertWorkspaceAccess } from "../../utils/workspaces"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const db = drizzle(c.env.DB)
    const workspaceIdParam = c.req.query("workspaceId")

    if (workspaceIdParam) {
      const workspaceId = Number(workspaceIdParam)
      if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
        return c.json({ success: false, error: "Invalid workspaceId" }, 400)
      }
      await assertWorkspaceAccess(c, workspaceId)
    }

    const workspaceIds = await getAccessibleWorkspaceIds(c)
    if (workspaceIds.length === 0) {
      return c.json({ success: true, data: [] })
    }

    const rows = await db.select().from(rules)
    return c.json({ success: true, data: rows })
  } catch (error) {
    console.error("Error listing rules:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list rules",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
