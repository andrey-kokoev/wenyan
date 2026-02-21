import { buildGateway } from '../src'
import { SqliteArchiveRepository } from '@andrey-kokoev/wenyan-archive/sqlite'
import { ReliableChannel } from '@andrey-kokoev/wenyan-channel'
import { DEV_SEAL_CONTEXT } from '@andrey-kokoev/wenyan-seal'

async function main(): Promise<void> {
  const repo = new SqliteArchiveRepository(':memory:')
  repo.initialize()
  repo.migrate()
  const app = buildGateway(repo, new ReliableChannel(), DEV_SEAL_CONTEXT, { lawMode: 'strict' })

  const iterations = Number(process.env.WENYAN_FUZZ_ITERS ?? 200)
  for (let i = 0; i < iterations; i += 1) {
    const payload = i % 3 === 0 ? '{bad-json' : JSON.stringify({ hello: i })
    await app.request('/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-noise': 'x'.repeat((i % 16) * 32),
      },
      body: payload,
    })
  }
  repo.close()
}

void main()
