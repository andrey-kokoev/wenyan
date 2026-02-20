import { writeFileSync } from 'node:fs'

function randomComponent(i: number) {
  return { id: `tile_${String(i).padStart(4, '0')}`, hash: `h${i}` }
}

const workers = Number(process.argv.find((x) => x.startsWith('--workers='))?.split('=')[1] ?? 1000)
const sample = Array.from({ length: 1000 }, (_, i) => randomComponent(i + 1))
const selected = sample.slice(0, 10)
const registry = {
  workers,
  components: sample,
  sample: selected,
  signed_root: 'jade-root-v0.7.0',
  generatedAt: new Date().toISOString(),
}
writeFileSync('jade_registry.json', JSON.stringify(registry, null, 2))
console.log(JSON.stringify({ ok: true, sample: selected.length, workers }))
