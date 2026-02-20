#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseBootstrapConfigToml } from '@wenyan/core'
import { BridgeGateway } from './gateway'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const cmd = args[0] ?? 'run'
  const configFlag = args.find((a: string) => a.startsWith('--config=')) ?? ''
  const configPath = configFlag ? configFlag.slice('--config='.length) : (args[1]?.startsWith('--') ? undefined : args[1]) ?? 'wenyan.toml'
  const configText = await readFile(resolve(configPath), 'utf8')
  const bootstrap = parseBootstrapConfigToml(configText)
  const bridge = new BridgeGateway({ bootstrap })

  if (cmd === 'status') {
    const status = await bridge.status()
    console.log(JSON.stringify(status, null, 2))
    return
  }
  if (cmd === 'sync') {
    const adapterFlag = args.find((a: string) => a.startsWith('--adapter='))
    const adapter = adapterFlag ? adapterFlag.slice('--adapter='.length) : undefined
    await bridge.start()
    const result = await bridge.syncOnce(adapter)
    await bridge.stop()
    console.log(JSON.stringify(result, null, 2))
    return
  }

  await bridge.start()
  console.log('wenyan-bridge running')
  process.on('SIGINT', async () => {
    await bridge.stop()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await bridge.stop()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
