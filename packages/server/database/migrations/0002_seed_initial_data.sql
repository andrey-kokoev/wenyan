-- Seed initial data for development
-- Created: 2026-01-31

-- Add approved domains
INSERT OR IGNORE INTO approved_domains (domain, is_active) VALUES
  ('kokoev.name', 1),
  ('global-maxima.com', 1);

-- Add Developer role
-- IMPORTANT: This ID must match DEV_ROLE_ID constant in packages/shared/src/constants.ts
INSERT OR IGNORE INTO roles (id, name, description) VALUES
  (2, 'Developer', 'Development team access');

-- Assign all permissions to Developer role (same as Admin)
INSERT OR IGNORE INTO roles_rel_controlled_actions (role_id, controlled_action_id)
SELECT 2, id FROM controlled_actions;

-- Assign Developer role to andrey@kokoev.name
INSERT OR IGNORE INTO external_user_ids_rel_roles (external_user_id, role_id)
VALUES ('andrey@kokoev.name', 2);
