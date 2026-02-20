// ============================================================================
// PATCH /api/workspaces/:id - Update a workspace
// ============================================================================

import { z } from "zod"
import { eq } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../../types/env"
import { workspaces } from "../../../database/workspaces/schema"
import { assertWorkspaceAccess } from "../../../utils/workspaces"
import { validatePositiveInt } from "../../../utils/validation"

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  allRulesAvailableInWorkspace: z.boolean().optional(),
})

export const middleware = zValidator("json", updateWorkspaceSchema)

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

    const body = await c.req.json()
    const data = updateWorkspaceSchema.parse(body)
    const db = drizzle(c.env.DB)

    // Build update object
    const updateData: Partial<typeof workspaces.$inferInsert> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.allRulesAvailableInWorkspace !== undefined) {
      updateData.allRulesAvailableInWorkspace = data.allRulesAvailableInWorkspace
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ success: false, error: "No fields to update" }, 400)
    }

    const result = await db
      .update(workspaces)
      .set(updateData)
      .where(eq(workspaces.id, id))
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        ownerId: workspaces.ownerId,
        isPersonal: workspaces.isPersonal,
        allRulesAvailableInWorkspace: workspaces.allRulesAvailableInWorkspace,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })

    if (result.length === 0) {
      return c.json({ success: false, error: "Workspace not found" }, 404)
    }

    return c.json({
      success: true,
      data: result[0],
    })
  } catch (error) {
    console.error("Error updating workspace:", error)
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: "Validation error",
        details: error.issues,
      }, 400)
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update workspace",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}
