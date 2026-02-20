import { spawnSync } from 'node:child_process'

const res = spawnSync('pnpm', ['--filter', '@wenyan/tests', 'test', '--', 'e2e/examples/rituals-0.6.0-examples.e2e.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, RUN_EXAMPLES_E2E: '1' },
})
process.exit(res.status ?? 1)
