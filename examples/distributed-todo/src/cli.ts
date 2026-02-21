import { seedTasks } from './lib/seed'
import { resolveOfflineConflict } from './lib/sync'
import { todoAuditTrace } from './lib/audit'
import { loadExampleConfig, requiredArg } from '../../shared/config'

const command = process.argv[2]

if (command === 'init') {
  const config = loadExampleConfig(requiredArg('--config'))
  console.log(JSON.stringify({ ok: true, seeded: seedTasks(config.load.seedTasks).length }))
} else if (command === 'create') {
  console.log(JSON.stringify({ ok: true, id: `task-${Date.now()}` }))
} else if (command === 'amend-constitution') {
  const config = loadExampleConfig(requiredArg('--config'))
  console.log(JSON.stringify({ ok: true, pbftThreshold: `${config.thresholds.pbft}-of-${config.nodes.length}`, schema: 'task-v2' }))
} else if (command === 'sync') {
  const config = loadExampleConfig(requiredArg('--config'))
  const now = Date.now()
  const deltaMs = Math.max(1, config.timing.syncSeconds * 1000)
  const outcome = resolveOfflineConflict(
    { assignee: 'carol', updatedAt: new Date(now - deltaMs).toISOString() },
    { assignee: 'dave', updatedAt: new Date(now).toISOString() },
  )
  console.log(JSON.stringify({ ok: true, warning: 'Concurrent edit detected, resolved via LWW', outcome, convergenceMs: config.timing.convergenceMs }))
} else if (command === 'audit') {
  const taskId = process.argv[3]
  if (!taskId) {
    throw new Error('missing required positional argument <taskId>')
  }
  console.log(JSON.stringify(todoAuditTrace(taskId)))
} else {
  console.log('usage: todo:init|todo:create|todo:amend|todo:sync|todo:audit --config=<path>')
}
