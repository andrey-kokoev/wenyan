import { execSync } from 'node:child_process'

const iters = process.env.WENYAN_FUZZ_ITERS ?? '200'
const cmds = [
  `WENYAN_FUZZ_ITERS=${iters} pnpm tsx packages/seal/fuzz/index.ts`,
  `WENYAN_FUZZ_ITERS=${iters} pnpm tsx packages/gateway/fuzz/index.ts`,
  `WENYAN_FUZZ_ITERS=${iters} pnpm tsx packages/bridge/fuzz/index.ts`,
]

for (const cmd of cmds) {
  execSync(cmd, { stdio: 'inherit' })
}
