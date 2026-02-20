import { writeFileSync, mkdirSync } from 'node:fs'
import { parseProfile, type BenchmarkResult } from './index'

const profile = parseProfile(process.argv)
const syntheticDocs = profile === 'toy' ? 10000 : 1000000
const result: BenchmarkResult = {
  profile,
  metric: 'synthetic_documents_simulated',
  value: syntheticDocs,
  unit: 'count',
}
mkdirSync('artifacts/benchmarks', { recursive: true })
writeFileSync(`artifacts/benchmarks/scale-${profile}.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
