// ============================================================================
// WORKSPACES, PROJECTS, DOCUMENTS, AND ISSUES SCHEMA
// ============================================================================

import { sqliteTable, integer, text, uniqueIndex, index } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

/**
 * Workspaces - owned by users (identified by email)
 * Each user gets a default personal workspace on first login
 */
export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(), // email of the owner
  isPersonal: integer("is_personal", { mode: "boolean" }).notNull().default(false),
  allRulesAvailableInWorkspace: integer("all_rules_available_in_workspace", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

/**
 * Projects - belong to a workspace
 * Documents are linked to projects
 */
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

/**
 * Documents - linked to projects
 * Previously standalone, now scoped to projects
 */
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(), // pdf, docx, txt, md
  content: text("content"), // For text-based files
  url: text("url"), // For web-based files
  storageKey: text("storage_key"), // Key in R2 storage
  status: text("status").notNull().default("uploaded"), // uploaded, processing, analyzed, error
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

/**
 * Application configuration (global key-value)
 */
export const appConfig = sqliteTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

/**
 * HttpJobs - async HTTP job runner records
 */
export const httpJobs = sqliteTable("http_jobs", {
  id: text("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  requestedBy: text("requested_by").notNull(),
  status: text("status").notNull(),
  requestJson: text("request_json").notNull(),
  responseStatus: integer("response_status"),
  responseKey: text("response_key"),
  error: text("error"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
}, (table) => ({
  httpJobsStatusIdx: index("idx_http_jobs_status").on(table.status),
  httpJobsProjectIdx: index("idx_http_jobs_project").on(table.projectId),
}))

/**
 * Issues - tracked problems or tasks within a project
 */
export const issues = sqliteTable("issues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed
  origin: text("origin").notNull().default("manual"), // manual, ai
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  markedAsNonissueBy: text("marked_as_nonissue_by"),
  markedAsNonissueAt: integer("marked_as_nonissue_at"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

/**
 * IssuesRelDocuments - links issues to documents
 * Many-to-many relationship between issues and documents
 */
export const issuesRelDocuments = sqliteTable("issues_rel_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  anchorType: text("anchor_type"),
  anchorStart: integer("anchor_start"),
  anchorEnd: integer("anchor_end"),
  anchorText: text("anchor_text"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

/**
 * IssuesRelRules - links issues to rules
 */
export const issuesRelRules = sqliteTable("issues_rel_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  ruleId: integer("rule_id")
    .notNull()
    .references(() => rules.id, { onDelete: "cascade" }),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

/**
 * Themes - registry of available color themes stored in R2
 */
export const themes = sqliteTable("themes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  r2Key: text("r2_key").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull(),
  visibility: text("visibility").notNull().default("public"),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

/**
 * Rules - reusable policy/config items (global)
 */
export const rules = sqliteTable("rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
}, (table) => ({
  ruleCodeUnique: uniqueIndex("rules_code_unique_idx").on(table.code),
}))

/**
 * ProjectsRelRules - links rules to projects
 */
export const projectsRelRules = sqliteTable(
  "projects_rel_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ruleId: integer("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch('now'))`),
  },
  (table) => ({
    projectRuleUnique: uniqueIndex("projects_rel_rules_project_rule_idx").on(
      table.projectId,
      table.ruleId,
    ),
  }),
)

/**
 * WorkspacesRelRules - links rules to workspaces (enabled rules)
 */
export const workspacesRelRules = sqliteTable(
  "workspaces_rel_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ruleId: integer("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch('now'))`),
  },
  (table) => ({
    workspaceRuleUnique: uniqueIndex("workspaces_rel_rules_workspace_rule_idx").on(
      table.workspaceId,
      table.ruleId,
    ),
  }),
)

/**
 * RuleSets - collections of rules (global)
 */
export const ruleSets = sqliteTable("rule_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch('now'))`),
})

/**
 * RuleSetRelRule - links rules to rule sets
 */
export const ruleSetRelRules = sqliteTable(
  "rule_set_rel_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ruleSetId: integer("rule_set_id")
      .notNull()
      .references(() => ruleSets.id, { onDelete: "cascade" }),
    ruleId: integer("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch('now'))`),
  },
  (table) => ({
    ruleSetRuleUnique: uniqueIndex("rule_set_rel_rules_rule_set_rule_idx").on(
      table.ruleSetId,
      table.ruleId,
    ),
  }),
)

/**
 * ProjectsRelRuleSets - links rule sets to projects
 */
export const projectsRelRuleSets = sqliteTable(
  "projects_rel_rule_sets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ruleSetId: integer("rule_set_id")
      .notNull()
      .references(() => ruleSets.id, { onDelete: "cascade" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch('now'))`),
  },
  (table) => ({
    projectRuleSetUnique: uniqueIndex("projects_rel_rule_sets_project_rule_set_idx").on(
      table.projectId,
      table.ruleSetId,
    ),
  }),
)

/**
 * AI provider catalog - providers, models, and modes
 */
export const aiProviders = sqliteTable(
  "ai_providers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    defaultBaseUrl: text("default_base_url"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch('now'))`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch('now'))`),
  },
  (table) => ({
    keyUnique: uniqueIndex("ai_providers_key_idx").on(table.key),
  }),
)

/**
 * AI responders - map internal purposes to providers
 */
export const aiResponders = sqliteTable(
  "ai_responders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    purpose: text("purpose").notNull(),
    providerKey: text("provider_key").notNull(),
    model: text("model").notNull(),
    modelType: text("model_type").notNull().default("chat"),
    maxOutputTokens: integer("max_output_tokens"),
    settingsJson: text("settings_json"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch('now'))`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch('now'))`),
  },
  (table) => ({
    purposeIdx: index("ai_responders_purpose_idx").on(table.purpose),
    purposeProviderUnique: uniqueIndex("ai_responders_purpose_provider_idx").on(
      table.purpose,
      table.providerKey,
    ),
  }),
)

export type WorkspaceRow = typeof workspaces.$inferSelect
export type WorkspaceRowInsert = Omit<typeof workspaces.$inferInsert, "id" | "createdAt" | "updatedAt">

export type ProjectRow = typeof projects.$inferSelect
export type ProjectRowInsert = Omit<typeof projects.$inferInsert, "id" | "createdAt" | "updatedAt">

export type DocumentRow = typeof documents.$inferSelect
export type DocumentRowInsert = Omit<typeof documents.$inferInsert, "id" | "createdAt" | "updatedAt">

export type IssueRow = typeof issues.$inferSelect
export type IssueRowInsert = Omit<typeof issues.$inferInsert, "id" | "createdAt" | "updatedAt">

export type IssueRelDocumentRow = typeof issuesRelDocuments.$inferSelect
export type IssueRelDocumentRowInsert = Omit<typeof issuesRelDocuments.$inferInsert, "id" | "createdAt">

export type IssueRelRuleRow = typeof issuesRelRules.$inferSelect
export type IssueRelRuleRowInsert = Omit<typeof issuesRelRules.$inferInsert, "id" | "createdAt">

export type ThemeRow = typeof themes.$inferSelect
export type ThemeRowInsert = typeof themes.$inferInsert

export type RuleRow = typeof rules.$inferSelect
export type RuleRowInsert = Omit<typeof rules.$inferInsert, "id" | "createdAt" | "updatedAt">

export type ProjectRelRuleRow = typeof projectsRelRules.$inferSelect
export type ProjectRelRuleRowInsert = Omit<typeof projectsRelRules.$inferInsert, "id" | "createdAt">

export type WorkspaceRelRuleRow = typeof workspacesRelRules.$inferSelect
export type WorkspaceRelRuleRowInsert = Omit<typeof workspacesRelRules.$inferInsert, "id" | "createdAt">

export type RuleSetRow = typeof ruleSets.$inferSelect
export type RuleSetRowInsert = Omit<typeof ruleSets.$inferInsert, "id" | "createdAt" | "updatedAt">

export type RuleSetRelRuleRow = typeof ruleSetRelRules.$inferSelect
export type RuleSetRelRuleRowInsert = Omit<typeof ruleSetRelRules.$inferInsert, "id" | "createdAt">

export type ProjectRelRuleSetRow = typeof projectsRelRuleSets.$inferSelect
export type ProjectRelRuleSetRowInsert = Omit<typeof projectsRelRuleSets.$inferInsert, "id" | "createdAt">

export type AiProviderRow = typeof aiProviders.$inferSelect
export type AiProviderRowInsert = Omit<typeof aiProviders.$inferInsert, "id" | "createdAt" | "updatedAt">

export type AiResponderRow = typeof aiResponders.$inferSelect
export type AiResponderRowInsert = Omit<
  typeof aiResponders.$inferInsert,
  "id" | "createdAt" | "updatedAt"
>
