import { spawnSync } from "node:child_process"

const dbName = process.env.HARMONIA_D1_DB ?? "harmonia-db"

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const providers = [
  {
    key: "cloudflare",
    name: "Cloudflare Workers AI",
    defaultBaseUrl: null,
  },
  {
    key: "anthropic",
    name: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
  },
]

const models = [
  {
    providerKey: "anthropic",
    key: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    model: "claude-sonnet-4-5",
    isDefault: true,
    sortOrder: 0,
  },
  {
    providerKey: "anthropic",
    key: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    model: "claude-haiku-4-5",
    isDefault: false,
    sortOrder: 1,
  },
  {
    providerKey: "anthropic",
    key: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    model: "claude-opus-4-5",
    isDefault: false,
    sortOrder: 2,
  },
  {
    providerKey: "cloudflare",
    key: "llama-3.1-8b-instruct-fast",
    name: "Llama 3.1 8B Instruct (Fast)",
    model: "@cf/meta/llama-3.1-8b-instruct-fast",
    isDefault: true,
    sortOrder: 0,
  },
  {
    providerKey: "cloudflare",
    key: "llama-3.3-70b-instruct-fp8-fast",
    name: "Llama 3.3 70B Instruct (FP8 Fast)",
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    isDefault: false,
    sortOrder: 1,
  },
  {
    providerKey: "cloudflare",
    key: "llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout 17B 16E Instruct",
    model: "@cf/meta/llama-4-scout-17b-16e-instruct",
    isDefault: false,
    sortOrder: 2,
  },
]

const modes = [
  {
    key: "standard",
    name: "Standard",
    settingsJson: null,
    isDefault: true,
    sortOrder: 0,
  },
  {
    key: "think-16k",
    name: "Think 16K",
    settingsJson: JSON.stringify({
      thinking: {
        type: "enabled",
        budget_tokens: 16000,
      },
    }),
    isDefault: false,
    sortOrder: 1,
  },
]

const providerStatements = providers
  .map((provider) => {
    const key = provider.key.replace(/'/g, "''")
    const name = provider.name.replace(/'/g, "''")
    const baseUrl = provider.defaultBaseUrl
      ? `'${provider.defaultBaseUrl.replace(/'/g, "''")}'`
      : "NULL"

    return `
      INSERT OR IGNORE INTO ai_providers (key, name, default_base_url, created_at, updated_at)
      VALUES ('${key}', '${name}', ${baseUrl}, unixepoch('now'), unixepoch('now'));
    `
  })
  .join("\n")

const modelStatements = models
  .map((model) => {
    const providerKey = model.providerKey.replace(/'/g, "''")
    const key = model.key.replace(/'/g, "''")
    const name = model.name.replace(/'/g, "''")
    const modelId = model.model.replace(/'/g, "''")
    const isDefault = model.isDefault ? 1 : 0

    return `
      INSERT OR IGNORE INTO ai_provider_models (
        provider_id,
        key,
        name,
        model,
        is_default,
        sort_order,
        created_at,
        updated_at
      )
      SELECT id, '${key}', '${name}', '${modelId}', ${isDefault}, ${model.sortOrder}, unixepoch('now'), unixepoch('now')
      FROM ai_providers
      WHERE key = '${providerKey}';
    `
  })
  .join("\n")

const modeStatements = models
  .flatMap((model) =>
    modes.map((mode) => ({
      providerKey: model.providerKey,
      modelKey: model.key,
      ...mode,
    })),
  )
  .map((entry) => {
    const providerKey = entry.providerKey.replace(/'/g, "''")
    const modelKey = entry.modelKey.replace(/'/g, "''")
    const key = entry.key.replace(/'/g, "''")
    const name = entry.name.replace(/'/g, "''")
    const settings = entry.settingsJson
      ? `'${entry.settingsJson.replace(/'/g, "''")}'`
      : "NULL"
    const isDefault = entry.isDefault ? 1 : 0

    return `
      INSERT OR IGNORE INTO ai_provider_model_modes (
        model_id,
        key,
        name,
        settings_json,
        is_default,
        sort_order,
        created_at,
        updated_at
      )
      SELECT models.id, '${key}', '${name}', ${settings}, ${isDefault}, ${entry.sortOrder}, unixepoch('now'), unixepoch('now')
      FROM ai_provider_models models
      INNER JOIN ai_providers providers ON providers.id = models.provider_id
      WHERE providers.key = '${providerKey}'
        AND models.key = '${modelKey}';
    `
  })
  .join("\n")

const insertSql = `
${providerStatements}
${modelStatements}
${modeStatements}
`.trim()

function seed(envLabel, flags) {
  console.log(`Seeding AI providers to D1 (${envLabel})...`)
  run("wrangler", ["d1", "execute", dbName, "--command", insertSql, ...flags])
}

seed("local", [])
seed("remote", ["--env", "production", "--remote"])

console.log("Seed complete.")
