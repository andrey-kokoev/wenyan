-- Add code column to rules and enforce uniqueness

ALTER TABLE rules ADD COLUMN code TEXT;

UPDATE rules
SET code = lower(replace(name, ' ', '_')) || '_' || id
WHERE code IS NULL OR code = '';

CREATE UNIQUE INDEX IF NOT EXISTS rules_code_unique_idx ON rules (code);

-- Ensure code is not null going forward by rebuilding the table
CREATE TABLE rules_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
);

INSERT INTO rules_new (id, code, name, description, created_at, updated_at)
SELECT id, code, name, description, created_at, updated_at
FROM rules;

DROP TABLE rules;
ALTER TABLE rules_new RENAME TO rules;
CREATE UNIQUE INDEX IF NOT EXISTS rules_code_unique_idx ON rules (code);
