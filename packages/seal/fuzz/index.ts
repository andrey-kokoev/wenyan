import { DEV_SEAL_CONTEXT, createSealChain, verifySealChain, type SealRecord } from '../src'

function randomId(i: number): string {
  return `fuzz-seal-${i}-${Math.random().toString(16).slice(2)}`
}

async function one(iter: number): Promise<void> {
  const message = {
    id: randomId(iter),
    genre: 'edict',
    payload: { law_type: 'regulation', content: { i: iter } },
    actor: { id: 'fuzzer', role: 'genesis_admin', kind: 'agent' },
    submittedAt: new Date().toISOString(),
    metadata: {},
  } as const
  const seals = await createSealChain(message, DEV_SEAL_CONTEXT)
  const ok = await verifySealChain(message, seals, DEV_SEAL_CONTEXT)
  if (!ok) throw new Error('seal-fuzz-verify-failed')
  if (iter % 2 === 0) {
    const tampered = [...seals] as SealRecord[]
    tampered[0] = { ...tampered[0], hash: `${tampered[0].hash}00` }
    const tamperedOk = await verifySealChain(message, tampered, DEV_SEAL_CONTEXT)
    if (tamperedOk) throw new Error('seal-fuzz-tamper-not-detected')
  }
}

async function main(): Promise<void> {
  const iterations = Number(process.env.WENYAN_FUZZ_ITERS ?? 500)
  for (let i = 0; i < iterations; i += 1) {
    await one(i)
  }
}

void main()
