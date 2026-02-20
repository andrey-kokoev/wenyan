-- ============================================================================
-- Add configure_application controlled action
-- ============================================================================

INSERT OR IGNORE INTO controlled_actions (code, name, description) VALUES
  ('configure_application', 'Configure application', 'Manage global application configuration');

-- Grant to Admin (1) and Developer (2)
INSERT OR IGNORE INTO roles_rel_controlled_actions (role_id, controlled_action_id)
SELECT 1, id FROM controlled_actions WHERE code = 'configure_application';

INSERT OR IGNORE INTO roles_rel_controlled_actions (role_id, controlled_action_id)
SELECT 2, id FROM controlled_actions WHERE code = 'configure_application';
