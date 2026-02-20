-- Add missing controlled actions
-- Created: 2026-02-02

-- Add manage_access_control permission (required for Access Control menu)
INSERT OR IGNORE INTO controlled_actions (code, name, description) VALUES
  ('manage_access_control', 'Manage Access Control', 'Manage roles, permissions, and access control settings');

-- Add view_debug_output permission (used in NavPanel for debug mode)
INSERT OR IGNORE INTO controlled_actions (code, name, description) VALUES
  ('view_debug_output', 'View Debug Output', 'View debug information and gates in navigation');

-- Assign these new permissions to Admin role (id=1)
INSERT OR IGNORE INTO roles_rel_controlled_actions (role_id, controlled_action_id)
SELECT 1, id FROM controlled_actions WHERE code IN ('manage_access_control', 'view_debug_output');

-- Assign these new permissions to Developer role (id=2)
INSERT OR IGNORE INTO roles_rel_controlled_actions (role_id, controlled_action_id)
SELECT 2, id FROM controlled_actions WHERE code IN ('manage_access_control', 'view_debug_output');
