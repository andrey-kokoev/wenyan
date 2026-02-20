PRAGMA foreign_keys=off;

CREATE TABLE `rules_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch('now')) NOT NULL
);

INSERT INTO `rules_new` (`id`, `name`, `description`, `created_at`, `updated_at`)
SELECT `id`, `name`, `description`, `created_at`, `updated_at`
FROM `rules`;

DROP TABLE `rules`;
ALTER TABLE `rules_new` RENAME TO `rules`;

CREATE TABLE `rule_sets_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `created_at` integer DEFAULT (unixepoch('now')) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch('now')) NOT NULL
);

INSERT INTO `rule_sets_new` (`id`, `name`, `description`, `created_at`, `updated_at`)
SELECT `id`, `name`, `description`, `created_at`, `updated_at`
FROM `rule_sets`;

DROP TABLE `rule_sets`;
ALTER TABLE `rule_sets_new` RENAME TO `rule_sets`;

PRAGMA foreign_keys=on;
