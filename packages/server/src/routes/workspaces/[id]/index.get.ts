// ============================================================================
// GET /api/workspaces/:id - Get a single workspace
// ============================================================================

import { eq } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../../types/env"
import { workspaces } from "../../../database/workspaces/schema"
import { assertWorkspaceAccess } from "../../../utils/workspaces"
import { validatePositiveInt } from "../../../utils/validation"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const id = validatePositiveInt(c.req.param("id"))
    if (id === null) {
      return c.json({ success: false, error: "Invalid workspace ID: must be a positive integer" }, 400)
    }

    // Check access
    await assertWorkspaceAccess(c, id)

    const db = drizzle(c.env.DB)
    const [workspace] = await db
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
      .where(eq(workspaces.id, id))
      .limit(1)

    if (!workspace) {
      return c.json({ success: false, error: "Workspace not found" }, 404)
    }

    return c.json({
      success: true,
      data: workspace,
    })
  } catch (error) {
    console.error("Error getting workspace:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get workspace",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}
