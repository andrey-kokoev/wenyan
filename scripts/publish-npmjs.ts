import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

type Json = Record<string, unknown>

const PUBLISHABLE_DIRS = [
  'packages/core',
  'packages/actor',
  'packages/seal',
  'packages/archive',
  'packages/pipeline',
  'packages/gateway',
  'packages/channel',
  'packages/gossip',
  'packages/crdt',
  'packages/consensus',
  'packages/bridge',
  'packages/genesis',
  'packages/censorate',
  'packages/imperial-works',
  'packages/mobile-foreman',
  'packages/cli',
] as const

function isAlreadyPublished(name: string, version: string, registry: string): boolean {
  try {
    const out = execSync(`npm view "${name}@${version}" version --registry ${registry}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    return out === version
  } catch (error) {
    const message = String(error)
    if (
      message.includes('E404') ||
      message.includes('404 Not Found') ||
      message.includes('is not in this registry')
    ) {
      return false
    }
    throw error
  }
}

function readJson(path: string): Json {
  return JSON.parse(readFileSync(path, 'utf8')) as Json
}

function writeJson(path: string, value: Json): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function remapName(name: string): string {
  if (!name.startsWith('@andrey-kokoev/wenyan-')) return name
  return name.replace('@andrey-kokoev/', '@wenyan2/')
}

function remapDeps(
  section: Json | undefined,
  versionsByName: Map<string, string>,
): Json | undefined {
  if (!section) return undefined

  const out: Json = {}
  for (const [depName, rawVersion] of Object.entries(section)) {
    const nextName = remapName(depName)
    const version = String(rawVersion)
    if (nextName !== depName) {
      const sourceVersion = versionsByName.get(depName)
      if (!sourceVersion) {
        throw new Error(`missing workspace version for ${depName}`)
      }
      out[nextName] = version.startsWith('workspace:') ? sourceVersion : version
      continue
    }
    out[nextName] = version
  }
  return out
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run')
  const root = process.cwd()
  const stagingRoot = mkdtempSync(join(tmpdir(), 'wenyan-npmjs-publish-'))

  try {
    execSync('pnpm -r build', { stdio: 'inherit', cwd: root })

    const manifests = PUBLISHABLE_DIRS.map((dir) => {
      const full = resolve(root, dir)
      const manifest = readJson(join(full, 'package.json'))
      return { dir, full, manifest }
    })

    const versionsByName = new Map<string, string>()
    for (const { manifest, dir } of manifests) {
      const name = String(manifest.name ?? '')
      const version = String(manifest.version ?? '')
      if (!name || !version) {
        throw new Error(`missing name/version in ${dir}/package.json`)
      }
      versionsByName.set(name, version)
    }

    for (const { dir, full, manifest } of manifests) {
      const pkgName = String(manifest.name)
      const stageDir = join(stagingRoot, basename(dir))
      cpSync(full, stageDir, {
        recursive: true,
        force: true,
        filter: (src) => {
          const rel = src.slice(full.length).replace(/^\/+/, '')
          if (!rel) return true
          if (rel.startsWith('node_modules')) return false
          if (rel.startsWith('src')) return false
          if (rel.startsWith('.turbo')) return false
          if (rel.startsWith('coverage')) return false
          return true
        },
      })

      const stageManifest = readJson(join(stageDir, 'package.json'))
      stageManifest.name = remapName(String(stageManifest.name))
      stageManifest.publishConfig = {
        ...(stageManifest.publishConfig as Json | undefined),
        registry: 'https://registry.npmjs.org',
      }
      delete stageManifest.private

      if ('scripts' in stageManifest) {
        delete stageManifest.scripts
      }

      stageManifest.dependencies = remapDeps(
        stageManifest.dependencies as Json | undefined,
        versionsByName,
      )
      stageManifest.peerDependencies = remapDeps(
        stageManifest.peerDependencies as Json | undefined,
        versionsByName,
      )
      stageManifest.optionalDependencies = remapDeps(
        stageManifest.optionalDependencies as Json | undefined,
        versionsByName,
      )

      if (!existsSync(join(stageDir, 'dist'))) {
        throw new Error(`dist not found for ${pkgName}; run build before publish`)
      }

      writeJson(join(stageDir, 'package.json'), stageManifest)

      const publishName = String(stageManifest.name)
      const publishVersion = String(stageManifest.version)
      if (isAlreadyPublished(publishName, publishVersion, 'https://registry.npmjs.org')) {
        console.log(`[publish:npmjs] skip ${publishName}@${publishVersion} (already published)`)
        continue
      }

      const cmd = dryRun
        ? 'npm publish --dry-run --access public --registry https://registry.npmjs.org'
        : 'npm publish --access public --registry https://registry.npmjs.org'
      execSync(cmd, { stdio: 'inherit', cwd: stageDir })
    }
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true })
  }
}

main()
