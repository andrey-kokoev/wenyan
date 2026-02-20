// ============================================================================
// POST /api/workspaces/:id/clone - Clone a workspace with its linked rules
// ============================================================================

import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../../types/env"
import { workspaces, workspacesRelRules } from "../../../../database/workspaces/schema"
import { assertWorkspaceAccess, getUserEmail } from "../../../../utils/workspaces"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  let createdWorkspaceId: number | null = null
  try {
    const workspaceId = Number(c.req.param("id"))
    if (!Number.isFinite(workspaceId)) {
      return c.json({ success: false, error: "Invalid workspace id" }, 400)
    }

    await assertWorkspaceAccess(c, workspaceId)

    const db = drizzle(c.env.DB)

    const [sourceWorkspace] = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        allRulesAvailableInWorkspace: workspaces.allRulesAvailableInWorkspace,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    if (!sourceWorkspace) {
      return c.json({ success: false, error: "Workspace not found" }, 404)
    }

    const email = getUserEmail(c)
    const clonedName = buildCloneName(sourceWorkspace.name)

    const [createdWorkspace] = await db
      .insert(workspaces)
      .values({
        name: clonedName,
        ownerId: email,
        isPersonal: false,
        allRulesAvailableInWorkspace: sourceWorkspace.allRulesAvailableInWorkspace,
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
    createdWorkspaceId = createdWorkspace?.id ?? null

    const sourceWorkspaceRules = await db
      .select({ ruleId: workspacesRelRules.ruleId })
      .from(workspacesRelRules)
      .where(eq(workspacesRelRules.workspaceId, workspaceId))

    if (sourceWorkspaceRules.length > 0) {
      await db.insert(workspacesRelRules).values(
        sourceWorkspaceRules.map((row) => ({
          workspaceId: createdWorkspace.id,
          ruleId: row.ruleId,
        }))
      )
    }

    return c.json({ success: true, data: createdWorkspace }, 201)
  } catch (error) {
    if (createdWorkspaceId) {
      try {
        const db = drizzle(c.env.DB)
        await db.delete(workspaces).where(eq(workspaces.id, createdWorkspaceId))
      } catch (cleanupError) {
        console.error("Failed to rollback workspace clone:", cleanupError)
      }
    }
    console.error("Error cloning workspace:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clone workspace",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}

function buildCloneName(sourceName: string): string {
  const prefix = "Copy of "
  const maxLength = 100
  const base = sourceName.trim() || "Workspace"
  const available = maxLength - prefix.length
  if (available <= 0) return prefix.slice(0, maxLength)
  return `${prefix}${base.slice(0, available)}`
}
