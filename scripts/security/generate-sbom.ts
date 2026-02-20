import { mkdirSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

mkdirSync('artifacts/sbom', { recursive: true })
try {
  execSync('syft dir:. -o json=artifacts/sbom/packages.sbom.json', { stdio: 'inherit' })
} catch {
  const fallback = {
    note: 'syft not installed in this environment',
    generatedAt: new Date().toISOString(),
    source: 'fallback-manifest',
  }
  writeFileSync('artifacts/sbom/packages.sbom.json', JSON.stringify(fallback, null, 2))
  console.log('[sbom] syft missing; wrote fallback manifest')
}
