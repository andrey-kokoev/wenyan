import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core"

// region: USER MANAGEMENT AND CONTROLS
export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
})

export const externalUserIdsRelRoles = sqliteTable(
  "external_user_ids_rel_roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalUserId: text("external_user_id").notNull().unique(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
  },
)

export const controlledActions = sqliteTable("controlled_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull().unique(),
  description: text("description"),
})

export const rolesRelControlledActions = sqliteTable(
  "roles_rel_controlled_actions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    controlledActionId: integer("controlled_action_id")
      .notNull()
      .references(() => controlledActions.id, { onDelete: "restrict" }),
  },
)
// endregion: USER MANAGEMENT AND CONTROLS
