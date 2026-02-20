// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/auth/db.ts
// Last synced: 2026-01-31
// ============================================================================

import { eq, inArray } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { normalizeEmail } from "./email"
import * as schema from "./schema"

/**
 * Get user roles by email
 */
export async function getUserRoles(
  db: DrizzleD1Database<typeof schema>,
  email: string
): Promise<number[]> {
  const normalized = normalizeEmail(email)
  
  const rows = await db
    .select({ roleId: schema.externalUserIdsRelRoles.roleId })
    .from(schema.externalUserIdsRelRoles)
    .where(eq(schema.externalUserIdsRelRoles.externalUserId, normalized))
  
  return [...new Set(rows.map(r => r.roleId))]
}

/**
 * Get controlled actions for roles
 */
export async function getControlledActions(
  db: DrizzleD1Database<typeof schema>,
  roleIds: number[]
): Promise<string[]> {
  if (roleIds.length === 0) return []
  
  const rows = await db
    .select({ code: schema.controlledActions.code })
    .from(schema.controlledActions)
    .innerJoin(
      schema.rolesRelControlledActions,
      eq(schema.controlledActions.id, schema.rolesRelControlledActions.controlledActionId)
    )
    .where(inArray(schema.rolesRelControlledActions.roleId, roleIds))
  
  return [...new Set(rows.map(r => r.code))]
}

/**
 * Check if any approved domains exist
 */
export async function hasApprovedDomains(
  db: DrizzleD1Database<typeof schema>
): Promise<boolean> {
  const domains = await db
    .select()
    .from(schema.approvedDomains)
    .where(eq(schema.approvedDomains.isActive, true))
  
  return domains.length > 0
}

/**
 * Full access control check
 */
export async function checkAccess(
  db: DrizzleD1Database<typeof schema>,
  email: string
): Promise<{
  allowed: boolean
  roles: number[]
  controlledActions: string[]
  reason?: string
}> {
  // Check if any domains are approved
  const domainsExist = await hasApprovedDomains(db)
  if (!domainsExist) {
    return { allowed: false, roles: [], controlledActions: [], reason: "no_approved_domains" }
  }
  
  // Get roles
  const roles = await getUserRoles(db, email)
  if (roles.length === 0) {
    return { allowed: false, roles: [], controlledActions: [], reason: "no_roles" }
  }
  
  // Get permissions
  const actions = await getControlledActions(db, roles)
  if (actions.length === 0) {
    return { allowed: false, roles, controlledActions: [], reason: "no_permissions" }
  }
  
  return { allowed: true, roles, controlledActions: actions }
}
