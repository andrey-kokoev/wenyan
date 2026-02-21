import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { loadExampleConfig, requiredArg } from '../../shared/config'

function randomComponent(i: number) {
  return { id: `tile_${String(i).padStart(4, '0')}`, hash: `h${i}` }
}

const config = loadExampleConfig(requiredArg('--config'))
const workerArg = process.argv.find((x) => x.startsWith('--workers='))?.split('=')[1]
const totalWorkers = workerArg ? Number(workerArg) : config.load.workers
const sample = Array.from({ length: totalWorkers }, (_, i) => randomComponent(i + 1))
const selected = sample.slice(0, config.thresholds.auditSample)
const signedRoot = createHash('sha256')
  .update(sample.map((item) => item.hash).join('|'))
  .digest('hex')
const registry = {
  workers: totalWorkers,
  components: sample,
  sample: selected,
  signed_root: signedRoot,
  generatedAt: new Date().toISOString(),
}
writeFileSync('jade_registry.json', JSON.stringify(registry, null, 2))
console.log(JSON.stringify({ ok: true, sample: selected.length, workers: totalWorkers, signed_root: signedRoot }))
