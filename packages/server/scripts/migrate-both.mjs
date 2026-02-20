import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const wranglerConfig = resolve(root, "wrangler.toml")
const dbName = process.env.HARMONIA_D1_DB ?? "harmonia-db"

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.log("Applying D1 migrations (local)...")
run("wrangler", ["d1", "migrations", "apply", dbName, "--config", wranglerConfig])

console.log("Applying D1 migrations (remote)...")
run("wrangler", ["d1", "migrations", "apply", dbName, "--config", wranglerConfig, "--remote"])

console.log("Migrations complete.")
