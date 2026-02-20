import { existsSync } from 'node:fs'

const required = [
  'packages/core/src/index.ts',
  'packages/seal/src/index.ts',
  'packages/gateway/src/index.ts',
  'packages/pipeline/src/index.ts',
  'packages/archive/src/index.ts',
  'packages/channel/src/index.ts',
  'packages/actor/src/index.ts',
  'packages/cli/src/index.ts',
  'genesis/wenyan.md',
]

const missing = required.filter((p) => !existsSync(new URL(`../${p}`, import.meta.url)))
if (missing.length > 0) {
  throw new Error(`Genesis verify failed. Missing: ${missing.join(', ')}`)
}

console.log('genesis verify ok')
