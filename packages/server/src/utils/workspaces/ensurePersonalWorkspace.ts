// ============================================================================
// ENSURE PERSONAL WORKSPACE
// Creates a default personal workspace for a user on first login
// ============================================================================

import { eq, and } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../types/env"
import { workspaces, projects } from "../../database/workspaces/schema"

/**
 * Ensure the user has a personal workspace
 * Creates one if it doesn't exist
 */
export async function ensurePersonalWorkspace(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  email: string
): Promise<number> {
  const normalizedEmail = email.trim().toLowerCase()
  const db = drizzle(c.env.DB)

  // Check if personal workspace already exists
  const [existing] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, normalizedEmail),
        eq(workspaces.isPersonal, true)
      )
    )
    .limit(1)

  if (existing) {
    return existing.id
  }

  // Create personal workspace
  const result = await db
    .insert(workspaces)
    .values({
      name: "My Personal Workspace",
      ownerId: normalizedEmail,
      isPersonal: true,
    })
    .returning({ id: workspaces.id })

  const workspaceId = result[0]?.id
  if (!workspaceId) {
    throw new Error(`Failed to create personal workspace for user: ${normalizedEmail}. The database insert operation did not return a workspace ID.`)
  }

  // Create a default project in the personal workspace
  await db
    .insert(projects)
    .values({
      name: "Default Project",
      description: "Your default project for document analysis",
      workspaceId,
    })
  
  return workspaceId
}

/**
 * Middleware to ensure personal workspace exists
 * Call this after auth middleware to auto-create workspace on first API access
 */
export async function ensurePersonalWorkspaceMiddleware(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: () => Promise<void>
): Promise<void> {
  const auth = c.get("auth")
  if (auth?.type === "user" && auth.user?.email) {
    try {
      const workspaceId = await ensurePersonalWorkspace(c, auth.user.email)
    } catch (error) {
      console.error("[WorkspaceMiddleware] Failed to ensure personal workspace:", error)
      // Don't fail the request if workspace creation fails
    }
  }
  await next()
}
