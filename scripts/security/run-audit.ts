import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
// v1.0 gate focuses runtime dependencies; dev-toolchain advisories are tracked separately.
execSync('pnpm audit --prod --audit-level moderate', { stdio: 'inherit' })

const packagesDir = join(root, 'packages')
const rustTargets = existsSync(packagesDir)
  ? readdirSync(packagesDir)
      .map((d) => join(packagesDir, d, 'Cargo.toml'))
      .filter((p) => existsSync(p))
  : []

if (rustTargets.length === 0) {
  console.log('[security:audit] no rust targets detected; skipping cargo audit')
  process.exit(0)
}

for (const cargoToml of rustTargets) {
  const dir = dirname(cargoToml)
  execSync('cargo audit', { cwd: dir, stdio: 'inherit' })
}
