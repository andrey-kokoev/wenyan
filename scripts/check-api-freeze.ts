import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

type Snapshot = Record<string, unknown>

const targets = [
  { name: '@andrey-kokoev/wenyan-core', file: 'packages/core/package.json' },
  { name: '@andrey-kokoev/wenyan-gossip', file: 'packages/gossip/package.json' },
  { name: '@andrey-kokoev/wenyan-bridge', file: 'packages/bridge/package.json' },
]

const outDir = '.api-freeze'
mkdirSync(outDir, { recursive: true })

let changed = false
for (const target of targets) {
  const pkg = JSON.parse(readFileSync(target.file, 'utf8')) as { exports?: Snapshot }
  const next = JSON.stringify(pkg.exports ?? {}, null, 2)
  const snapPath = join(outDir, `${target.name.replace(/[\/@]/g, '_')}.exports.json`)
  if (!existsSync(snapPath)) {
    writeFileSync(snapPath, `${next}\n`)
    continue
  }
  const prev = readFileSync(snapPath, 'utf8')
  if (prev.trim() !== next.trim()) {
    changed = true
  }
}

if (changed) {
  console.error('Frozen API export maps changed. Add an explicit api-break changeset or restore exports.')
  process.exit(1)
}

console.log('API freeze check passed.')
