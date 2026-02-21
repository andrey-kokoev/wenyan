import { simulateAttack } from './lib/attack-sim'
import { exportMonthlyAudit } from './lib/audit-export'
import { geographicImpossible } from './lib/geo-check'
import { loadExampleConfig, requiredArg } from '../../shared/config'

const command = process.argv[2]

if (command === 'propose') {
  console.log(JSON.stringify({ ok: true, status: 'pending-parent-approval' }))
} else if (command === 'attack-simulate') {
  loadExampleConfig(requiredArg('--config'))
  const attemptsArg = process.argv[3]
  if (!attemptsArg) {
    throw new Error('missing required positional argument <attempts>')
  }
  const attempts = Number(attemptsArg)
  if (!Number.isFinite(attempts) || attempts < 1) {
    throw new Error('attempts must be a positive number')
  }
  console.log(JSON.stringify({ ok: true, ...simulateAttack(attempts), alert: 'velocity_violation' }))
} else if (command === 'audit-export') {
  const config = loadExampleConfig(requiredArg('--config'))
  const month = process.argv[3]
  if (!month) {
    throw new Error('missing required positional argument <month>')
  }
  const transactions = Math.max(1, config.load.attackAttempts * config.thresholds.pbft)
  console.log(JSON.stringify(exportMonthlyAudit(month, transactions)))
} else if (command === 'geo-check') {
  loadExampleConfig(requiredArg('--config'))
  const distanceArg = process.argv[3]
  const deltaArg = process.argv[4]
  if (!distanceArg || !deltaArg) {
    throw new Error('missing required positional arguments <distanceKm> <deltaSeconds>')
  }
  const distance = Number(distanceArg)
  const delta = Number(deltaArg)
  if (!Number.isFinite(distance) || !Number.isFinite(delta)) {
    throw new Error('distanceKm and deltaSeconds must be numeric')
  }
  console.log(JSON.stringify({ impossible: geographicImpossible(distance, delta) }))
} else {
  console.log('usage: treasury:propose|treasury:attack|treasury:audit --config=<path>')
}
