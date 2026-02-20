// ============================================================================
// DELETE /api/workspaces/:id - Delete a workspace
// ============================================================================

import { eq } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../../types/env"
import { workspaces } from "../../../database/workspaces/schema"
import { isAdmin } from "@wenyan/shared"
import { assertWorkspaceAccess } from "../../../utils/workspaces"
import { validatePositiveInt } from "../../../utils/validation"

export default async function handler(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  try {
    const id = validatePositiveInt(c.req.param("id"))
    if (id === null) {
      return c.json(
        { success: false, error: "Invalid workspace ID: must be a positive integer" },
        400,
      )
    }

    // Check access
    await assertWorkspaceAccess(c, id)

    // Log the user attempting the deletion and enforce stricter checks for sensitive ops
    const auth = c.get("auth")?.user
    const maskedEmail = auth?.email
      ? `${auth.email.charAt(0)}***@${auth.email.split("@")[1] || "unknown"}`
      : "unknown"
    console.info(
      `Workspace delete requested - workspace ID: ${id}, user: ${maskedEmail}, userId: ${auth?.id ? "***" + String(auth.id).slice(-4) : "unknown"}`,
    )

    if (!auth) {
      console.warn(`Unauthorized delete attempt - no auth - workspace ID: ${id}`)
      return c.json({ success: false, error: "Unauthorized" }, 401)
    }

    const db = drizzle(c.env.DB)

    // Check if it's a personal workspace - don't allow deletion; also fetch owner for additional verification
    const [workspace] = await db
      .select({ isPersonal: workspaces.isPersonal, ownerId: workspaces.ownerId })
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1)

    if (!workspace) {
      return c.json({ success: false, error: "Workspace not found" }, 404)
    }

    // Only allow deletion by workspace owner or admins
    const userIsAdmin = isAdmin(auth?.roles)
    if (!userIsAdmin && workspace.ownerId && String(auth.email) !== String(workspace.ownerId)) {
      const maskedEmail = auth?.email
        ? `${auth.email.charAt(0)}***@${auth.email.split("@")[1] || "unknown"}`
        : String(auth?.id)
      console.warn(
        `Forbidden delete attempt - user ${maskedEmail} is not owner nor admin - workspace ID: ${id}`,
      )
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    if (workspace.isPersonal) {
      const maskedEmail = auth?.email
        ? `${auth.email.charAt(0)}***@${auth.email.split("@")[1] || "unknown"}`
        : "unknown"
      console.warn(
        `Attempt to delete personal workspace blocked - workspace ID: ${id}, user: ${maskedEmail}`,
      )
      return c.json({ success: false, error: "Cannot delete personal workspace" }, 400)
    }

    await db.delete(workspaces).where(eq(workspaces.id, id))

    return c.json({
      success: true,
      message: "Workspace deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting workspace:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete workspace",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
