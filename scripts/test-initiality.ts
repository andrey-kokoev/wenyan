import { buildGateway } from '../packages/gateway/src/index.ts'
import { SqliteArchiveRepository } from '../packages/archive/src/sqlite.ts'
import { ReliableChannel } from '../packages/channel/src/index.ts'
import { DEV_SEAL_CONTEXT } from '../packages/seal/src/index.ts'
import { NatsIntoWenyanAdapter } from '../examples/nats-bridge/adapter.ts'
import { existsSync, unlinkSync } from 'node:fs'

async function main(): Promise<void> {
  const dbPath = './.tmp-initiality.sqlite'
  if (existsSync(dbPath)) unlinkSync(dbPath)

  const repo = new SqliteArchiveRepository(dbPath)
  repo.initialize()
  repo.migrate()
  const channel = new ReliableChannel()
  const app = buildGateway(repo, channel, DEV_SEAL_CONTEXT)
  const adapter = new NatsIntoWenyanAdapter()

  const envelope = adapter.toWenyanEnvelope({
    subject: 'external.nats.event',
    data: { text: 'hello from S in MsgSys' },
    actorId: 'bridge-actor',
  })

  const submit = await app.request('/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  })
  if (submit.status !== 201 && submit.status !== 202) {
    throw new Error(`Submit failed: ${submit.status}`)
  }
  const submitBody = (await submit.json()) as { id?: string }
  const messageId = submitBody.id ?? envelope.id

  const statusRes = await app.request(`/messages/${encodeURIComponent(messageId)}`)
  if (statusRes.status !== 200) {
    throw new Error(`Status failed: ${statusRes.status}`)
  }
  const status = await statusRes.json()
  if (status.state !== 'archived') {
    throw new Error(`Expected archived state, got ${String(status.state)}`)
  }

  repo.close()
  console.log('initiality bridge ok')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
