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
  ('rule_generation', 'cloudflare', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'chat', NULL, NULL, 0),
  ('rule_duplicate_check', 'cloudflare', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'chat', NULL, NULL, 0),
  ('issue_analysis', 'cloudflare', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'chat', NULL, NULL, 0),
  ('rule_generation', 'anthropic', 'claude-sonnet-4-5', 'chat', NULL, NULL, 0),
  ('rule_duplicate_check', 'anthropic', 'claude-sonnet-4-5', 'chat', NULL, NULL, 0),
  ('issue_analysis', 'anthropic', 'claude-sonnet-4-5', 'chat', NULL, NULL, 0);
