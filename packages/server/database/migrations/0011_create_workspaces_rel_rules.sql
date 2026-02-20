CREATE TABLE `workspaces_rel_rules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `workspace_id` integer NOT NULL,
  `rule_id` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade,
  FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `workspaces_rel_rules_workspace_rule_idx` ON `workspaces_rel_rules` (`workspace_id`,`rule_id`);
