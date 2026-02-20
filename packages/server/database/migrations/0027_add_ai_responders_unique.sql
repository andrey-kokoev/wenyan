CREATE UNIQUE INDEX IF NOT EXISTS ai_responders_purpose_provider_idx
ON ai_responders(purpose, provider_key);
