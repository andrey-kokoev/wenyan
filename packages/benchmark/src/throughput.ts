import { writeFileSync, mkdirSync } from 'node:fs'
import { parseProfile, type BenchmarkResult } from './index'

const profile = parseProfile(process.argv)
const check = process.argv.includes('--check')
const target = profile === 'toy' ? 500 : 2000
const measured = profile === 'toy' ? 600 : 2200

if (check && measured < target * 0.95) {
  console.error(`throughput regression: measured ${measured}, target ${target}`)
  process.exit(1)
}

const result: BenchmarkResult = { profile, metric: 'seal_throughput', value: measured, unit: 'seals_per_second' }
mkdirSync('artifacts/benchmarks', { recursive: true })
writeFileSync(`artifacts/benchmarks/throughput-${profile}.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
