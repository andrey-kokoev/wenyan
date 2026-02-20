const sensors = Number(process.argv[2] ?? 100)
const seconds = Number(process.argv[3] ?? 300)
console.log(JSON.stringify({ sensors, seconds, messages: sensors * seconds }))
