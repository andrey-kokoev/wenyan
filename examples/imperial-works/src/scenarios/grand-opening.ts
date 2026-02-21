import { emergencyDrill } from './emergency-drill'
import { offlineForemanSync } from './offline-foreman'
import { loadExampleConfig, requiredArg } from '../../../shared/config'

const config = loadExampleConfig(requiredArg('--config'))
console.log(
  JSON.stringify({
    drill: emergencyDrill(config.load.workers, config.timing.routingLatencyMs),
    sync: offlineForemanSync(config.thresholds.auditSample, config.timing.syncSeconds),
  }),
)
