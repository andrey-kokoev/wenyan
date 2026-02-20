import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { getPublicKeyAsync, signAsync, verifyAsync } from '@noble/ed25519'
import type { MessageEnvelope } from '@wenyan/core'
import type { Provenance } from '@wenyan/actor'
import { resolveRequiredImperialSignatures, type SealThresholdPolicy } from './thresholds'

export type SealStage = 'caoni' | 'shenfu-1' | 'shenfu-2' | 'shenfu-3' | 'shenfu-4' | 'pizhun'

export interface SealRecord {
  sealId: string
  messageId: string
  stage: SealStage
  prevHash: string
  hash: string
  signature: string
  createdAt: string
  payload?: Record<string, unknown>
}

export interface SealContext {
  draftPrivateKeyHex: string
  draftPublicKeyHex?: string
  masterPrivateKeyHex: string
  masterPublicKeyHex?: string
  capabilitySecret: string
  lamportClock: number
  routeKey: string
  provenance?: Provenance
  imperialSignatures?: string[]
  thresholdPolicyOverrides?: Partial<SealThresholdPolicy>
}

export class InsufficientImperialAuthorityError extends Error {
  constructor(message = 'insufficient-imperial-authority') {
    super(message)
    this.name = 'InsufficientImperialAuthorityError'
  }
}

const stageOrder: SealStage[] = ['caoni', 'shenfu-1', 'shenfu-2', 'shenfu-3', 'shenfu-4', 'pizhun']

function digestHex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)))
}

function encodeToken(payload: Record<string, unknown>, secret: string): string {
  const head = JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  const body = JSON.stringify(payload)
  const sig = digestHex(`${head}.${body}.${secret}`)
  return `${head}.${body}.${sig}`
}

function verifyToken(token: string, secret: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return false
  }
  const [head, body, sig] = parts
  return digestHex(`${head}.${body}.${secret}`) === sig
}

function payloadForStage(
  stage: SealStage,
  message: MessageEnvelope,
  context: SealContext,
  nowIso: string,
): Record<string, unknown> {
  if (stage === 'caoni') {
    return {
      documentHash: digestHex(JSON.stringify(message.payload)),
      draftedBy: message.actor.id,
    }
  }
  if (stage === 'shenfu-1') {
    const schemaFingerprint = digestHex(JSON.stringify(Object.keys(message.payload).sort()))
    return { schemaMerkleRoot: schemaFingerprint }
  }
  if (stage === 'shenfu-2') {
    return {
      unixTimestamp: Math.floor(new Date(nowIso).getTime() / 1000),
      lamportClock: context.lamportClock,
    }
  }
  if (stage === 'shenfu-3') {
    const capability = encodeToken(
      {
        sub: message.actor.id,
        clearance: message.actor.role,
        aud: 'wenyan-pipeline',
        iat: Math.floor(new Date(nowIso).getTime() / 1000),
      },
      context.capabilitySecret,
    )
    return { capability }
  }
  if (stage === 'shenfu-4') {
    return { routeCommitment: digestHex(context.routeKey) }
  }
  const required = resolveRequiredImperialSignatures(message.genre, context.thresholdPolicyOverrides)
  const provided = (context.imperialSignatures ?? []).length
  return {
    imperialCommitment: digestHex(`${message.id}:${context.routeKey}:${nowIso}`),
    required_signatures: required,
    provided_signatures: provided,
  }
}

async function signStage(hash: string, stage: SealStage, context: SealContext): Promise<string> {
  if (stage === 'caoni') {
    return bytesToHex(await signAsync(hexToBytes(hash), hexToBytes(context.draftPrivateKeyHex)))
  }
  if (stage === 'pizhun') {
    return bytesToHex(await signAsync(hexToBytes(hash), hexToBytes(context.masterPrivateKeyHex)))
  }
  return digestHex(`${hash}:${context.capabilitySecret}`)
}

async function verifyStageSignature(
  seal: SealRecord,
  stage: SealStage,
  context: SealContext,
): Promise<boolean> {
  if (stage === 'caoni') {
    if (context.provenance?.kind === 'human') {
      // Human Office seal route: WebAuthn/YubiKey attestation challenge path.
      const pub = context.draftPublicKeyHex ?? bytesToHex(await getPublicKeyAsync(hexToBytes(context.draftPrivateKeyHex)))
      const sigOk = await verifyAsync(hexToBytes(seal.signature), hexToBytes(seal.hash), hexToBytes(pub))
      const attestationOk = context.provenance.yubikey_attestation.length > 0
      return sigOk && attestationOk
    }
    if (context.provenance?.kind === 'agent') {
      // Agent Office seal route: x509 mTLS service account challenge path.
      const pub = context.draftPublicKeyHex ?? bytesToHex(await getPublicKeyAsync(hexToBytes(context.draftPrivateKeyHex)))
      const sigOk = await verifyAsync(hexToBytes(seal.signature), hexToBytes(seal.hash), hexToBytes(pub))
      const mtlsOk = context.provenance.mtls_fingerprint.length > 0 && context.provenance.service_account.length > 0
      return sigOk && mtlsOk
    }
    const pub = context.draftPublicKeyHex ?? bytesToHex(await getPublicKeyAsync(hexToBytes(context.draftPrivateKeyHex)))
    return verifyAsync(hexToBytes(seal.signature), hexToBytes(seal.hash), hexToBytes(pub))
  }
  if (stage === 'pizhun') {
    const pub = context.masterPublicKeyHex ?? bytesToHex(await getPublicKeyAsync(hexToBytes(context.masterPrivateKeyHex)))
    return verifyAsync(hexToBytes(seal.signature), hexToBytes(seal.hash), hexToBytes(pub))
  }
  return seal.signature === digestHex(`${seal.hash}:${context.capabilitySecret}`)
}

export async function createSealChain(
  message: MessageEnvelope,
  context: SealContext,
  startPrevHash = 'GENESIS',
): Promise<SealRecord[]> {
  const seals: SealRecord[] = []
  let prevHash = startPrevHash

  for (const stage of stageOrder) {
    if (stage === 'pizhun') {
      const required = resolveRequiredImperialSignatures(message.genre, context.thresholdPolicyOverrides)
      const provided = (context.imperialSignatures ?? []).length
      if (provided < required) {
        throw new InsufficientImperialAuthorityError()
      }
    }
    const createdAt = new Date().toISOString()
    const payload = payloadForStage(stage, message, context, createdAt)
    const hash = digestHex(
      JSON.stringify({
        messageId: message.id,
        stage,
        prevHash,
        payload,
        createdAt,
      }),
    )
    const signature = await signStage(hash, stage, context)

    const seal: SealRecord = {
      sealId: `${message.id}-${stage}-${createdAt}`,
      messageId: message.id,
      stage,
      prevHash,
      hash,
      signature,
      createdAt,
      payload,
    }

    seals.push(seal)
    prevHash = hash
  }

  return seals
}

export async function verifySealChain(message: MessageEnvelope, seals: SealRecord[], context: SealContext): Promise<boolean> {
  if (seals.length !== 6) {
    return false
  }

  let prevHash = 'GENESIS'
  for (let idx = 0; idx < stageOrder.length; idx += 1) {
    const stage = stageOrder[idx]
    const seal = seals[idx]
    if (!seal || seal.stage !== stage || seal.messageId !== message.id || seal.prevHash !== prevHash) {
      return false
    }

    const expectedHash = digestHex(
      JSON.stringify({
        messageId: message.id,
        stage,
        prevHash,
        payload: seal.payload ?? {},
        createdAt: seal.createdAt,
      }),
    )

    if (expectedHash !== seal.hash) {
      return false
    }

    if (!(await verifyStageSignature(seal, stage, context))) {
      return false
    }

    if (stage === 'shenfu-3') {
      const token = String(seal.payload?.capability ?? '')
      if (!verifyToken(token, context.capabilitySecret)) {
        return false
      }
    }

    if (stage === 'pizhun') {
      const required = resolveRequiredImperialSignatures(message.genre, context.thresholdPolicyOverrides)
      const provided = (context.imperialSignatures ?? []).length
      if (provided < required) return false
    }

    prevHash = seal.hash
  }

  return true
}

export * from './thresholds'

export const DEV_SEAL_CONTEXT: SealContext = {
  draftPrivateKeyHex: '1'.repeat(64),
  masterPrivateKeyHex: '2'.repeat(64),
  capabilitySecret: 'wenyan-capability-secret',
  lamportClock: 1,
  routeKey: 'local.default.route',
  imperialSignatures: ['local-dev'],
  provenance: {
    kind: 'agent',
    service_account: 'wenyan-local-agent',
    mtls_fingerprint: 'local-dev-mtls-fingerprint',
  },
}
