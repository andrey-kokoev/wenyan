import { unlinkSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { SqliteArchiveRepository } from '../packages/archive/src/sqlite.ts'

const dbPath = './.tmp-archive-persistence.sqlite'
if (existsSync(dbPath)) unlinkSync(dbPath)

const message = {
  id: `msg-${Date.now()}`,
  genre: 'memo',
  payload: { title: 'Persist me' },
  actor: { id: 'tester', role: 'admin' },
  submittedAt: new Date().toISOString(),
  metadata: { test: true },
}

const repo1 = new SqliteArchiveRepository(dbPath, { retentionDays: 30 })
repo1.initialize()
repo1.migrate()
repo1.appendMessage(message)
repo1.appendTransition({
  messageId: message.id,
  fromState: 'pending',
  toState: 'validated',
  sequenceNo: 1,
  actorId: 'tester',
  sealedAt: new Date().toISOString(),
  at: new Date().toISOString(),
  prevTransitionHash: 'GENESIS',
})
repo1.close()

const repo2 = new SqliteArchiveRepository(dbPath)
repo2.initialize()
const loaded = repo2.getMessage(message.id)
if (!loaded || loaded.id !== message.id) {
  throw new Error('Archive persistence failed: message not recovered after restart')
}
repo2.close()
console.log('archive persistence ok')
