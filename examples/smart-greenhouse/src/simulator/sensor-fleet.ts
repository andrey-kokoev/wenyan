import { loadExampleConfig, requiredArg } from '../../shared/config'

const config = loadExampleConfig(requiredArg('--config'))
const sensors = Number(process.argv.find((x) => x.startsWith('--sensors='))?.slice('--sensors='.length) ?? config.load.sensors)
const duration = Number(process.argv.find((x) => x.startsWith('--seconds='))?.slice('--seconds='.length) ?? config.load.durationSeconds)
const total = sensors * duration
console.log(JSON.stringify({ sensors, duration, total }))
