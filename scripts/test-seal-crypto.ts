import { DEV_SEAL_CONTEXT, createSealChain, verifySealChain } from '../packages/seal/src/index.ts'

async function main(): Promise<void> {
  const message = {
    id: `msg-${Date.now()}`,
    genre: 'memo',
    payload: { body: 'untampered' },
    actor: { id: 'tester', role: 'admin' as const },
    submittedAt: new Date().toISOString(),
    metadata: {},
  }

  const seals = await createSealChain(message, DEV_SEAL_CONTEXT)
  const valid = await verifySealChain(message, seals, DEV_SEAL_CONTEXT)
  if (!valid) {
    throw new Error('Expected valid seal chain to verify')
  }

  seals[2].payload = { ...(seals[2].payload ?? {}), lamportClock: 99999 }
  const tampered = await verifySealChain(message, seals, DEV_SEAL_CONTEXT)
  if (tampered) {
    throw new Error('Tampered seal chain must fail verification')
  }

  console.log('seal crypto verification ok')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
