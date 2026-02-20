import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

const root = resolve(import.meta.dirname, "..")
const sharedRoot = resolve(root, "../shared")
const distSchemaPath = resolve(sharedRoot, "dist/schemas/theme.js")

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (!existsSync(distSchemaPath)) {
  run("pnpm", ["-C", sharedRoot, "build"])
}

const { ThemeSchema } = await import(pathToFileURL(distSchemaPath).href)

const bucket = process.env.HARMONIA_R2_BUCKET ?? "harmonia-bucket"
const dbName = process.env.HARMONIA_D1_DB ?? "harmonia-db"
const wantProd = process.argv.includes("--prod")
const envFlag = wantProd ? ["--env", "production"] : []
const remoteFlag = wantProd ? ["--remote"] : []

const themeFiles = [
  { id: "default", name: "Default", version: "1.0.0", r2Key: "themes/default.json", isDefault: true },
  { id: "barry", name: "Barry", version: "1.0.0", r2Key: "themes/barry.json", isDefault: false },
]

console.log("Validating theme JSON...")
for (const theme of themeFiles) {
  const themePath = resolve(sharedRoot, `themes/${theme.id}.json`)
  const raw = readFileSync(themePath, "utf-8")
  const parsed = ThemeSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    console.error(`Theme ${theme.id} validation failed`)
    console.error(parsed.error.format())
    process.exit(1)
  }
}

const insertRows = themeFiles
  .map((theme) =>
    `('${theme.id}', '${theme.name}', '${theme.version}', '${theme.r2Key}', ${theme.isDefault ? 1 : 0}, 'system', 'public', unixepoch('now'))`,
  )
  .join(", ")

const insertSql =
  "INSERT OR IGNORE INTO themes (id, name, version, r2_key, is_default, created_by, visibility, updated_at) VALUES " +
  insertRows +
  ";"

function seed(envLabel, flags) {
  console.log(`Uploading themes to R2 (${envLabel})...`)
  for (const theme of themeFiles) {
    const themePath = resolve(sharedRoot, `themes/${theme.id}.json`)
    const putArgs = [
      "r2",
      "object",
      "put",
      `${bucket}/${theme.r2Key}`,
      "--file",
      themePath,
      "--content-type",
      "application/json",
      ...flags,
    ]
    run("wrangler", putArgs)
  }

  const d1Args = ["d1", "execute", dbName, "--command", insertSql, ...flags]
  console.log(`Seeding themes to D1 (${envLabel})...`)
  run("wrangler", d1Args)
}

seed("local", [])
seed("remote", ["--env", "production", "--remote"])

console.log("Seed complete.")
