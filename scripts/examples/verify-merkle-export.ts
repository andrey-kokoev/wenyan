import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: tsx scripts/examples/verify-merkle-export.ts <bundle.json>')
  process.exit(1)
}
const data = JSON.parse(readFileSync(file, 'utf8'))
const digest = createHash('sha256').update(JSON.stringify(data.checkpoint ?? {})).digest('hex')
console.log(JSON.stringify({ digest }))
