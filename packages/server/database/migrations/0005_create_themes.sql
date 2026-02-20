CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
);

CREATE INDEX IF NOT EXISTS themes_is_default_idx ON themes (is_default);
