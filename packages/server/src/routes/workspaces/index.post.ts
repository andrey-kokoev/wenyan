// ============================================================================
// POST /api/workspaces - Create a new workspace
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../types/env"
import { workspaces } from "../../database/workspaces/schema"
import { getUserEmail } from "../../utils/workspaces"

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  allRulesAvailableInWorkspace: z.boolean().optional(),
})

export const middleware = zValidator("json", createWorkspaceSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const email = getUserEmail(c)
    const body = await c.req.json()
    const data = createWorkspaceSchema.parse(body)
    const db = drizzle(c.env.DB)

    const result = await db
      .insert(workspaces)
      .values({
        name: data.name,
        ownerId: email,
        isPersonal: false,
        allRulesAvailableInWorkspace: data.allRulesAvailableInWorkspace ?? true,
      })
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        ownerId: workspaces.ownerId,
        isPersonal: workspaces.isPersonal,
        allRulesAvailableInWorkspace: workspaces.allRulesAvailableInWorkspace,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })

    return c.json({
      success: true,
      data: result[0],
    }, 201)
  } catch (error) {
    console.error("Error creating workspace:", error)
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
        error: error instanceof Error ? error.message : "Failed to create workspace",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}
