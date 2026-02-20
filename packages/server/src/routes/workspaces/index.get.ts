// ============================================================================
// GET /api/workspaces - List all accessible workspaces
// ============================================================================

import { eq } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../types/env"
import { workspaces } from "../../database/workspaces/schema"
import { getUserEmail, getAccessibleWorkspaceIds } from "../../utils/workspaces"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const email = getUserEmail(c)
    
    const db = drizzle(c.env.DB)

    // Get workspace IDs the user has access to
    const accessibleIds = await getAccessibleWorkspaceIds(c, email)

    if (accessibleIds.length === 0) {
      return c.json({
        success: true,
        data: [],
      })
    }

    // Fetch the workspaces
    const rows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        ownerId: workspaces.ownerId,
        isPersonal: workspaces.isPersonal,
        allRulesAvailableInWorkspace: workspaces.allRulesAvailableInWorkspace,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaces)
      .where(eq(workspaces.ownerId, email))

    return c.json({
      success: true,
      data: rows,
    })
  } catch (error) {
    console.error("Error listing workspaces:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list workspaces",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}
