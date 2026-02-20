const sensors = Number(process.argv.find((x) => x.startsWith('--sensors='))?.slice('--sensors='.length) ?? 100)
const duration = Number(process.argv.find((x) => x.startsWith('--seconds='))?.slice('--seconds='.length) ?? 300)
const total = sensors * duration
console.log(JSON.stringify({ sensors, duration, total }))
