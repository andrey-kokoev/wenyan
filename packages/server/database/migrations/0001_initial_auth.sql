-- Initial auth tables
-- Created: 2026-01-31

-- Approved domains for sign-in
CREATE TABLE IF NOT EXISTS approved_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Email to role mappings
CREATE TABLE IF NOT EXISTS external_user_ids_rel_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_user_id TEXT NOT NULL,
  role_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_external_user_id 
  ON external_user_ids_rel_roles(external_user_id);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT
);

-- Role to permission mappings
CREATE TABLE IF NOT EXISTS roles_rel_controlled_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  controlled_action_id INTEGER NOT NULL
);

-- Permissions (controlled actions)
CREATE TABLE IF NOT EXISTS controlled_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT
);

-- Failed auth attempts (audit log)
CREATE TABLE IF NOT EXISTS failed_auth_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  microsoft_user_id TEXT,
  attempted_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
);

-- Successful auth attempts (audit log)
CREATE TABLE IF NOT EXISTS succeeded_auth_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  microsoft_user_id TEXT,
  attempted_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
);

-- Seed data: insert some default controlled actions
-- NOTE: These are essential system permissions required for basic functionality.
-- Additional environment-specific permissions should be added via separate migration
-- files or configuration management tools, not by modifying this migration.
INSERT INTO controlled_actions (code, name, description)
VALUES
  ('view_documents', 'View Documents', 'Access document list and details'),
  ('upload_documents', 'Upload Documents', 'Upload new documents'),
  ('delete_documents', 'Delete Documents', 'Delete existing documents'),
  ('manage_users', 'Manage Users', 'Add/remove users and assign roles'),
  ('manage_access_control', 'Manage Access Control', 'Manage roles, permissions, and access control settings'),
  ('view_analytics', 'View Analytics', 'Access analytics and reports'),
  ('view_debug_output', 'View Debug Output', 'View debug information and gates in navigation')
ON CONFLICT(code) DO UPDATE SET
  name = excluded.name,
  description = excluded.description;

-- Seed data: insert a default admin role
-- IMPORTANT: This ID must match ADMIN_ROLE_ID constant in packages/shared/src/constants.ts
INSERT INTO roles (id, name, description)
VALUES
  (1, 'Admin', 'Full system access')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description;

-- Assign all permissions to admin role
INSERT OR IGNORE INTO roles_rel_controlled_actions (role_id, controlled_action_id)
SELECT 1, id FROM controlled_actions;
