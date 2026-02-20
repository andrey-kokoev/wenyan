ALTER TABLE workspaces
ADD COLUMN all_rules_available_in_workspace INTEGER NOT NULL DEFAULT 1;

UPDATE workspaces
SET all_rules_available_in_workspace = 1
WHERE all_rules_available_in_workspace IS NULL;
