import { existsSync, chmodSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const cwd = process.cwd()
const binPath = resolve(cwd, 'node_modules/.cache/nats-memory-server/nats-server')
const downloadScript = resolve(cwd, 'node_modules/nats-memory-server/dist/scripts/download.js')
const buildScript = resolve(cwd, 'node_modules/nats-memory-server/dist/scripts/build.js')

if (existsSync(binPath)) {
  process.exit(0)
}

if (!existsSync(downloadScript)) {
  throw new Error(`nats-memory-server download script not found at ${downloadScript}`)
}

execFileSync(process.execPath, [downloadScript], { cwd, stdio: 'inherit' })

if (existsSync(buildScript)) {
  execFileSync(process.execPath, [buildScript], { cwd, stdio: 'inherit' })
}

if (!existsSync(binPath)) {
  throw new Error(`failed to provision nats-server binary at ${binPath}`)
}

chmodSync(binPath, 0o755)
