import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

type PkgSpec = {
  name: string
  dir: string
}

const packages: PkgSpec[] = [
  { name: '@wenyan/core', dir: 'packages/core' },
  { name: '@wenyan/actor', dir: 'packages/actor' },
  { name: '@wenyan/seal', dir: 'packages/seal' },
  { name: '@wenyan/archive', dir: 'packages/archive' },
  { name: '@wenyan/pipeline', dir: 'packages/pipeline' },
  { name: '@wenyan/gateway', dir: 'packages/gateway' },
  { name: '@wenyan/channel', dir: 'packages/channel' },
  { name: '@wenyan/gossip', dir: 'packages/gossip' },
  { name: '@wenyan/crdt', dir: 'packages/crdt' },
  { name: '@wenyan/consensus', dir: 'packages/consensus' },
  { name: '@wenyan/genesis', dir: 'packages/genesis' },
  { name: '@wenyan/cli', dir: 'packages/cli' },
]

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

function assertDistPathExists(pkgDir: string, rel: string): void {
  const full = resolve(pkgDir, rel)
  try {
    readFileSync(full)
  } catch {
    throw new Error(`missing publish entrypoint: ${full}`)
  }
}

function validateEntrypoints(pkgDir: string): void {
  const manifest = readJson(resolve(pkgDir, 'package.json'))
  const main = manifest.main
  if (typeof main === 'string' && main.startsWith('./dist/')) {
    assertDistPathExists(pkgDir, main)
  }
  const types = manifest.types
  if (typeof types === 'string' && types.startsWith('./dist/')) {
    assertDistPathExists(pkgDir, types)
  }

  const exp = manifest.exports
  if (exp && typeof exp === 'object') {
    for (const value of Object.values(exp as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      for (const leaf of Object.values(value as Record<string, unknown>)) {
        if (typeof leaf === 'string' && leaf.startsWith('./dist/')) {
          assertDistPathExists(pkgDir, leaf)
        }
      }
    }
  }
}

function listTar(tarPath: string): string[] {
  const out = execSync(`tar -tf "${tarPath}"`, { encoding: 'utf8' })
  return out.split('\n').map((s) => s.trim()).filter(Boolean)
}

function run(): void {
  const packDir = resolve('.tmp-pack-check')
  rmSync(packDir, { force: true, recursive: true })
  mkdirSync(packDir, { recursive: true })

  for (const pkg of packages) {
    validateEntrypoints(pkg.dir)

    execSync(`npm pack --silent --pack-destination "${packDir}"`, {
      stdio: 'pipe',
      cwd: resolve(pkg.dir),
    })

    const manifest = readJson(resolve(pkg.dir, 'package.json'))
    const version = manifest.version
    if (typeof version !== 'string') throw new Error(`missing version in ${pkg.dir}/package.json`)
    const unscoped = pkg.name.split('/')[1]
    const tarPath = join(packDir, `wenyan-${unscoped}-${version}.tgz`)

    const entries = listTar(tarPath)
    const hasDist = entries.some((e) => e.startsWith('package/dist/'))
    const hasSrc = entries.some((e) => e.startsWith('package/src/'))
    if (!hasDist) throw new Error(`${pkg.name}: tarball does not include dist/`)
    if (hasSrc) throw new Error(`${pkg.name}: tarball includes src/`)
  }

  console.log('release pack check passed')
}

run()
