import { loadExampleConfig, requiredArg } from '../../shared/config'

const config = loadExampleConfig(requiredArg('--config'))
console.log(JSON.stringify({ nodes: config.nodes, tiers: config.tiers, topology: 'imperial-works' }))
