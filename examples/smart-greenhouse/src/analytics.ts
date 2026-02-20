const at = process.argv.find((x) => x.startsWith('--at='))?.slice('--at='.length)
if (at) {
  console.log(JSON.stringify({ at, value: 2.5, certainty: 'archived' }))
} else {
  console.log(JSON.stringify({ ok: true }))
}
