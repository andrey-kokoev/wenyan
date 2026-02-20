-- Add created_by column to rules and backfill existing rows

ALTER TABLE rules ADD COLUMN created_by TEXT;

UPDATE rules
SET created_by = 'system'
WHERE created_by IS NULL OR created_by = '';

-- Rebuild table to enforce NOT NULL
CREATE TABLE rules_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
);

INSERT INTO rules_new (id, code, name, description, created_by, created_at, updated_at)
SELECT id, code, name, description, created_by, created_at, updated_at
FROM rules;

DROP TABLE rules;
ALTER TABLE rules_new RENAME TO rules;
CREATE UNIQUE INDEX IF NOT EXISTS rules_code_unique_idx ON rules (code);
