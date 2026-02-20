-- ============================================================================
-- AI Providers Catalog
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  default_base_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_providers_key_idx ON ai_providers (key);

CREATE TABLE IF NOT EXISTS ai_provider_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  model TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  FOREIGN KEY (provider_id) REFERENCES ai_providers (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_models_provider_key_idx
  ON ai_provider_models (provider_id, key);

CREATE TABLE IF NOT EXISTS ai_provider_model_modes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  settings_json TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  FOREIGN KEY (model_id) REFERENCES ai_provider_models (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_model_modes_model_key_idx
  ON ai_provider_model_modes (model_id, key);

-- Seed minimal providers + default models/modes
INSERT OR IGNORE INTO ai_providers (key, name, default_base_url)
VALUES
  ('cloudflare', 'Cloudflare Workers AI', NULL),
  ('anthropic', 'Anthropic', 'https://api.anthropic.com');

INSERT OR IGNORE INTO ai_provider_models (provider_id, key, name, model, is_default, sort_order)
SELECT id, 'default', 'Default', '@cf/meta/llama-3.1-8b-instruct', 1, 0
FROM ai_providers
WHERE key = 'cloudflare';

INSERT OR IGNORE INTO ai_provider_models (provider_id, key, name, model, is_default, sort_order)
SELECT id, 'default', 'Default', 'claude-3-5-sonnet-20240620', 1, 0
FROM ai_providers
WHERE key = 'anthropic';

INSERT OR IGNORE INTO ai_provider_model_modes (model_id, key, name, is_default, sort_order)
SELECT id, 'standard', 'Standard', 1, 0
FROM ai_provider_models
WHERE key = 'default'
  AND provider_id = (SELECT id FROM ai_providers WHERE key = 'cloudflare');

INSERT OR IGNORE INTO ai_provider_model_modes (model_id, key, name, is_default, sort_order)
SELECT id, 'standard', 'Standard', 1, 0
FROM ai_provider_models
WHERE key = 'default'
  AND provider_id = (SELECT id FROM ai_providers WHERE key = 'anthropic');
