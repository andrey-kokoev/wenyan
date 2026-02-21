import { parseBootstrapConfig } from '@andrey-kokoev/wenyan-core'
import { BridgeGateway } from '../src/gateway'

async function main(): Promise<void> {
  const bootstrap = parseBootstrapConfig({
    archive: { engine: 'sqlite', path: ':memory:' },
    genesis: { node_id: '00000000-0000-4000-8000-000000000010', genesis_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
    gateway: { listen: { host: '127.0.0.1', port: 8787 } },
    bridge: {
      enabled: true,
      mode: 'standalone',
      adapters: [{ id: 'k', protocol: 'kafka', brokers: ['x'], topics: ['a'], consumer_group: 'g', target_genre: 'edict', trust_provenance: true }],
      sync: { mode: 'poll', poll_interval_ms: 10_000, batch_size: 10 },
      circuit_breaker: { failure_rate_threshold: 0.5, cool_down_ms: 1000, max_retries: 3 },
    },
  })

  const gateway = new BridgeGateway({ bootstrap, apiBaseUrl: 'http://127.0.0.1:8787/api/wenyan' })
  const samples = [
    { topic: '__proto__', partition: 0, offset: '1', value: { a: 1 }, headers: { __proto__: 'x' } },
    { topic: 'topic/ok', partition: 0, offset: '2', value: { b: 2 }, headers: { constructor: 'y' } },
  ]
  for (const s of samples) {
    try {
      await gateway.dryRun('k', s)
    } catch {
      // expected for invalid metadata fuzz cases
    }
  }
}

void main()
