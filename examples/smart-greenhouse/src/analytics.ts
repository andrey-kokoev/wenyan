import { loadExampleConfig, requiredArg } from '../../shared/config'

const at = requiredArg('--at')
loadExampleConfig(requiredArg('--config'))
const valueArg = requiredArg('--value')
const value = Number(valueArg)
if (!Number.isFinite(value)) {
  throw new Error('--value must be numeric')
}
console.log(JSON.stringify({ at, value, certainty: 'archived' }))
