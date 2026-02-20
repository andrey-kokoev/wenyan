/**
 * Application-level constants
 * Shared between frontend and backend
 */

// region: ROLE IDs
// These IDs are hardcoded in the database migrations and must match
// See: packages/server/database/migrations/0001_initial_auth.sql
//      packages/server/database/migrations/0002_seed_initial_data.sql

/** Admin role ID - Full system access */
export const ADMIN_ROLE_ID = 1 as const

/** Developer role ID - Development team access */
export const DEV_ROLE_ID = 2 as const

/** All system role IDs that are protected from modification */
export const SYSTEM_ROLE_IDS = [ADMIN_ROLE_ID, DEV_ROLE_ID] as const

// Type for system role IDs
type SystemRoleId = (typeof SYSTEM_ROLE_IDS)[number]

/**
 * Check if a role ID is a system role (protected from modification)
 * @param roleId - The role ID to check
 * @returns True if the role is a system role
 */
export function isSystemRole(roleId: number): roleId is SystemRoleId {
  return SYSTEM_ROLE_IDS.includes(roleId as SystemRoleId)
}

/**
 * Check if a user has admin role
 * @param roleIds - Array of user's role IDs
 * @returns True if user is an admin
 */
export function isAdmin(roleIds: number[] | undefined | null): boolean {
  return Boolean(roleIds?.includes(ADMIN_ROLE_ID))
}

/**
 * Check if a user has developer role
 * @param roleIds - Array of user's role IDs
 * @returns True if user is a developer
 */
export function isDeveloper(roleIds: number[] | undefined | null): boolean {
  return Boolean(roleIds?.includes(DEV_ROLE_ID))
}

// endregion: ROLE IDs

// region: Semantic colors
export const SEMANTIC_COLORS = [
  "primary",
  "secondary",
  "success",
  "warning",
  "error",
  "info",
  "neutral",
] as const

export type SemanticColor = (typeof SEMANTIC_COLORS)[number]

// endregion: Semantic colors
