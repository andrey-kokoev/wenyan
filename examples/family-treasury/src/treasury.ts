import { simulateAttack } from './lib/attack-sim'
import { exportMonthlyAudit } from './lib/audit-export'
import { geographicImpossible } from './lib/geo-check'

const command = process.argv[2]

if (command === 'propose') {
  console.log(JSON.stringify({ ok: true, status: 'pending-parent-approval' }))
} else if (command === 'attack-simulate') {
  const attempts = Number(process.argv[3] ?? 50)
  console.log(JSON.stringify({ ok: true, ...simulateAttack(attempts), alert: 'velocity_violation' }))
} else if (command === 'audit-export') {
  console.log(JSON.stringify(exportMonthlyAudit(process.argv[3] ?? '2026-05')))
} else if (command === 'geo-check') {
  const distance = Number(process.argv[3] ?? 2400)
  const delta = Number(process.argv[4] ?? 60)
  console.log(JSON.stringify({ impossible: geographicImpossible(distance, delta) }))
} else {
  console.log('usage: treasury:propose|treasury:attack|treasury:audit')
}
