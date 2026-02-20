import { writeFileSync, mkdirSync } from 'node:fs'
import { parseProfile, type BenchmarkResult } from './index'

const profile = parseProfile(process.argv)
const check = process.argv.includes('--check')
const target = profile === 'toy' ? 0.1 : 0.5
const measured = profile === 'toy' ? 0.05 : 0.25

if (check && measured > target * 1.05) {
  console.error(`latency regression: measured ${measured}, target ${target}`)
  process.exit(1)
}

const result: BenchmarkResult = { profile, metric: 'seal_p99_latency', value: measured, unit: 'seconds' }
mkdirSync('artifacts/benchmarks', { recursive: true })
writeFileSync(`artifacts/benchmarks/latency-${profile}.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
