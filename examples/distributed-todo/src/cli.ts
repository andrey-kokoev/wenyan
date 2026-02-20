import { seedTasks } from './lib/seed'
import { resolveOfflineConflict } from './lib/sync'
import { todoAuditTrace } from './lib/audit'

const command = process.argv[2]

if (command === 'init') {
  console.log(JSON.stringify({ ok: true, seeded: seedTasks(50).length }))
} else if (command === 'create') {
  console.log(JSON.stringify({ ok: true, id: `task-${Date.now()}` }))
} else if (command === 'amend-constitution') {
  console.log(JSON.stringify({ ok: true, pbftThreshold: '3-of-4', schema: 'task-v2' }))
} else if (command === 'sync') {
  const outcome = resolveOfflineConflict(
    { assignee: 'carol', updatedAt: new Date(Date.now() - 1000).toISOString() },
    { assignee: 'dave', updatedAt: new Date().toISOString() },
  )
  console.log(JSON.stringify({ ok: true, warning: 'Concurrent edit detected, resolved via LWW', outcome }))
} else if (command === 'audit') {
  const taskId = process.argv[3] ?? 'task-1'
  console.log(JSON.stringify(todoAuditTrace(taskId)))
} else {
  console.log('usage: todo:init|todo:create|todo:amend|todo:sync|todo:audit')
}
