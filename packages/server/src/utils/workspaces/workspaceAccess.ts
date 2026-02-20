// ============================================================================
// WORKSPACE ACCESS CONTROL UTILITIES
// ============================================================================

import { eq, inArray } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../types/env"
import { workspaces, projects } from "../../database/workspaces/schema"

/**
 * Get the user's email from the auth context
 */
export function getUserEmail(c: Context<{ Bindings: Bindings; Variables: Variables }>): string {
  const auth = c.get("auth")
  if (auth?.type !== "user" || !auth.user?.email) {
    throw new Error("Unauthorized")
  }
  return auth.user.email.trim().toLowerCase()
}

/**
 * Check if user has access to a workspace
 * User has access if they are the owner
 */
export async function canAccessWorkspace(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  workspaceId: number,
  email?: string
): Promise<boolean> {
  const userEmail = email || getUserEmail(c)
  const db = drizzle(c.env.DB)

  const [workspace] = await db
    .select({ id: workspaces.id, ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  if (!workspace) return false
  return workspace.ownerId.trim().toLowerCase() === userEmail
}

/**
 * Get all workspace IDs accessible to the user
 */
export async function getAccessibleWorkspaceIds(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  email?: string
): Promise<number[]> {
  const userEmail = email || getUserEmail(c)
  const db = drizzle(c.env.DB)

  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userEmail))

  return rows.map((r) => r.id)
}

/**
 * Assert that user has access to a workspace
 * Throws if access is denied
 */
export async function assertWorkspaceAccess(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  workspaceId: number
): Promise<void> {
  const hasAccess = await canAccessWorkspace(c, workspaceId)
  if (!hasAccess) {
    throw new Error("Forbidden")
  }
}

/**
 * Check if user has access to a project
 * (via the project's workspace)
 */
export async function canAccessProject(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  projectId: number
): Promise<boolean> {
  const db = drizzle(c.env.DB)

  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) return false
  return canAccessWorkspace(c, project.workspaceId)
}

/**
 * Assert that user has access to a project
 * Throws if access is denied
 */
export async function assertProjectAccess(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  projectId: number
): Promise<void> {
  const hasAccess = await canAccessProject(c, projectId)
  if (!hasAccess) {
    throw new Error("Forbidden")
  }
}

/**
 * Get project IDs that belong to accessible workspaces
 */
export async function getAccessibleProjectIds(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  email?: string
): Promise<number[]> {
  const userEmail = email || getUserEmail(c)
  const workspaceIds = await getAccessibleWorkspaceIds(c, userEmail)
  
  if (workspaceIds.length === 0) return []

  const db = drizzle(c.env.DB)
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.workspaceId, workspaceIds))

  return rows.map((r) => r.id)
}
