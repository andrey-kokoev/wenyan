INSERT OR IGNORE INTO ai_providers (key, name, default_base_url, created_at, updated_at)
VALUES ('moonshot', 'Moonshot AI (Kimi)', 'https://api.moonshot.ai/v1', unixepoch('now'), unixepoch('now'));

INSERT OR IGNORE INTO ai_responders (
  purpose,
  provider_key,
  model,
  model_type,
  max_output_tokens,
  settings_json,
  sort_order
)
VALUES
  ('rule_generation', 'moonshot', 'moonshot-v1-32k', 'chat', NULL, NULL, 0),
  ('rule_duplicate_check', 'moonshot', 'moonshot-v1-32k', 'chat', NULL, NULL, 0),
  ('issue_analysis', 'moonshot', 'moonshot-v1-32k', 'chat', NULL, NULL, 0);
