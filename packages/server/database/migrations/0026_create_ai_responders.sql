CREATE TABLE IF NOT EXISTS ai_responders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purpose TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  model TEXT NOT NULL,
  model_type TEXT NOT NULL DEFAULT 'chat',
  max_output_tokens INTEGER,
  settings_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
);

CREATE INDEX IF NOT EXISTS ai_responders_purpose_idx ON ai_responders(purpose);
