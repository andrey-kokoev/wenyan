import { execSync } from 'node:child_process'

const PACKAGES = [
  '@andrey-kokoev/wenyan-core',
  '@andrey-kokoev/wenyan-actor',
  '@andrey-kokoev/wenyan-seal',
  '@andrey-kokoev/wenyan-archive',
  '@andrey-kokoev/wenyan-pipeline',
  '@andrey-kokoev/wenyan-gateway',
  '@andrey-kokoev/wenyan-channel',
  '@andrey-kokoev/wenyan-gossip',
  '@andrey-kokoev/wenyan-crdt',
  '@andrey-kokoev/wenyan-consensus',
  '@andrey-kokoev/wenyan-bridge',
  '@andrey-kokoev/wenyan-genesis',
  '@andrey-kokoev/wenyan-censorate',
  '@andrey-kokoev/wenyan-imperial-works',
  '@andrey-kokoev/wenyan-mobile-foreman',
  '@andrey-kokoev/wenyan-cli',
] as const

function isAlreadyPublished(name: string, version: string): boolean {
  try {
    const out = execSync(`npm view "${name}@${version}" version --registry https://npm.pkg.github.com`, {
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

const dryRun = process.argv.includes('--dry-run')

execSync('pnpm -r build', { stdio: 'inherit' })

for (const pkg of PACKAGES) {
  const version = execSync(`node -e "console.log(require('./package.json').version)"`, {
    encoding: 'utf8',
    cwd: `packages/${pkg.split('/')[1].replace('wenyan-', '')}`,
  }).trim()

  if (isAlreadyPublished(pkg, version)) {
    console.log(`[publish:github] skip ${pkg}@${version} (already published)`)
    continue
  }

  execSync(
    `pnpm --filter ${pkg} publish --no-git-checks --access public${dryRun ? ' --dry-run' : ''}`,
    { stdio: 'inherit' },
  )
}
