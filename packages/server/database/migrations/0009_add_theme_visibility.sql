ALTER TABLE `themes` ADD COLUMN `created_by` text NOT NULL DEFAULT 'system';
ALTER TABLE `themes` ADD COLUMN `visibility` text NOT NULL DEFAULT 'public';
