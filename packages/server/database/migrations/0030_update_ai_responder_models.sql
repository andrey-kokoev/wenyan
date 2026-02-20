UPDATE ai_responders
SET model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    updated_at = unixepoch('now')
WHERE provider_key = 'cloudflare';

UPDATE ai_responders
SET model = 'claude-sonnet-4-5',
    updated_at = unixepoch('now')
WHERE provider_key = 'anthropic';
