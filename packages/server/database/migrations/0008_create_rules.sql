CREATE TABLE `rules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `workspace_id` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE cascade
);

CREATE TABLE `projects_rel_rules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `project_id` integer NOT NULL,
  `rule_id` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `projects_rel_rules_project_rule_idx` ON `projects_rel_rules` (`project_id`,`rule_id`);
