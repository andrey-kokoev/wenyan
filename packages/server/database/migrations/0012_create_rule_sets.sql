CREATE TABLE `rule_sets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `workspace_id` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade
);

CREATE TABLE `rule_set_rel_rules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `rule_set_id` integer NOT NULL,
  `rule_id` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  FOREIGN KEY (`rule_set_id`) REFERENCES `rule_sets`(`id`) ON DELETE cascade,
  FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `rule_set_rel_rules_rule_set_rule_idx` ON `rule_set_rel_rules` (`rule_set_id`,`rule_id`);
CREATE INDEX `rule_sets_workspace_id_idx` ON `rule_sets` (`workspace_id`);
