CREATE TABLE `issues_rel_rules` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `issue_id` integer NOT NULL,
  `rule_id` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON DELETE cascade,
  FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON DELETE cascade
);

CREATE INDEX `issues_rel_rules_issue_id_idx` ON `issues_rel_rules` (`issue_id`);
CREATE INDEX `issues_rel_rules_rule_id_idx` ON `issues_rel_rules` (`rule_id`);
