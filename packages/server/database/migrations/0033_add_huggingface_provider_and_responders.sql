INSERT OR IGNORE INTO ai_providers (key, name, default_base_url, created_at, updated_at)
VALUES ('huggingface', 'Hugging Face Inference', 'https://router.huggingface.co/v1', unixepoch('now'), unixepoch('now'));

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
  ('rule_generation', 'huggingface', 'meta-llama/Llama-3.3-70B-Instruct', 'chat', NULL, NULL, 0),
  ('rule_duplicate_check', 'huggingface', 'meta-llama/Llama-3.3-70B-Instruct', 'chat', NULL, NULL, 0),
  ('issue_analysis', 'huggingface', 'meta-llama/Llama-3.3-70B-Instruct', 'chat', NULL, NULL, 0);
