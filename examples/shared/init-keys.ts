import { randomBytes } from 'node:crypto'

export function generateGenesisKey(): string {
  return randomBytes(32).toString('base64')
}

if (process.argv[1]?.endsWith('init-keys.ts')) {
  console.log(JSON.stringify({ GENESIS_KEY: generateGenesisKey() }))
}
