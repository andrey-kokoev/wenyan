CREATE TABLE `projects_rel_rule_sets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `project_id` integer NOT NULL,
  `rule_set_id` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade,
  FOREIGN KEY (`rule_set_id`) REFERENCES `rule_sets`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `projects_rel_rule_sets_project_rule_set_idx` ON `projects_rel_rule_sets` (`project_id`,`rule_set_id`);
