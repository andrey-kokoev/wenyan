// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/auth/schema.ts
// Last synced: 2026-01-31
// ============================================================================

import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

// Domains allowed to sign in
export const approvedDomains = sqliteTable("approved_domains", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
})

// Email → Role mappings (the core auth table)
export const externalUserIdsRelRoles = sqliteTable("external_user_ids_rel_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalUserId: text("external_user_id").notNull(), // email
  roleId: integer("role_id").notNull(),
})

// Roles
export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
})

// Role → Permission mappings
export const rolesRelControlledActions = sqliteTable("roles_rel_controlled_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roleId: integer("role_id").notNull(),
  controlledActionId: integer("controlled_action_id").notNull(),
})

// Permissions
export const controlledActions = sqliteTable("controlled_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(), // e.g., "view_documents"
  name: text("name").notNull(),
  description: text("description"),
})

// Audit logs
export const failedAuthAttempts = sqliteTable("failed_auth_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  reason: text("reason").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  microsoftUserId: text("microsoft_user_id"),
  attemptedAt: integer("attempted_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

export const succeededAuthAttempts = sqliteTable("successful_auth_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  microsoftUserId: text("microsoft_user_id"),
  attemptedAt: integer("attempted_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})
