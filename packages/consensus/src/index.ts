import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { getPublicKeyAsync, signAsync, verifyAsync } from '@noble/ed25519'

export type PbftPhase = 'pre-prepare' | 'prepare' | 'commit' | 'view-change'

export interface PbftMessage {
  proposalId: string
  viewNo: number
  nodeId: string
  phase: PbftPhase
  signature: string
  at: string
}

export interface PbftSignerConfig {
  replicaPublicKeys: Record<string, string>
  replicaPrivateKeys?: Record<string, string>
  allowSingleReplica?: boolean
}

export interface PbftOptions extends PbftSignerConfig {
  replicaSet: string[]
  threshold: number
  viewChangeTimeoutMs?: number
}

export type PbftMessageToSign = Omit<PbftMessage, 'signature'>

export class PbftValidationError extends Error {
  constructor(
    readonly code: 'invalid-threshold' | 'unknown-node' | 'invalid-phase' | 'invalid-signature' | 'missing-private-key',
    message: string,
  ) {
    super(message)
    this.name = 'PbftValidationError'
  }
}

export function canonicalPbftPayload(msg: PbftMessageToSign): string {
  return JSON.stringify({
    proposalId: msg.proposalId,
    viewNo: msg.viewNo,
    nodeId: msg.nodeId,
    phase: msg.phase,
    at: msg.at,
  })
}

export async function signPbftMessage(msg: PbftMessageToSign, privateKeyHex: string): Promise<string> {
  const sig = await signAsync(utf8ToBytes(canonicalPbftPayload(msg)), hexToBytes(privateKeyHex))
  return bytesToHex(sig)
}

export async function verifyPbftMessageSignature(
  msg: PbftMessage,
  publicKeyHex: string,
): Promise<boolean> {
  return verifyAsync(hexToBytes(msg.signature), utf8ToBytes(canonicalPbftPayload(msg)), hexToBytes(publicKeyHex))
}

export class PbftConsensus {
  private readonly log = new Map<string, PbftMessage[]>()
  private viewNo = 0
  private readonly publicKeys: Record<string, string>
  private readonly privateKeys: Record<string, string>

  constructor(private readonly options: PbftOptions) {
    if (options.threshold < 2 && !options.allowSingleReplica) {
      throw new PbftValidationError('invalid-threshold', 'PBFT threshold must be >= 2 unless allowSingleReplica is enabled')
    }
    this.publicKeys = { ...options.replicaPublicKeys }
    this.privateKeys = { ...(options.replicaPrivateKeys ?? {}) }
  }

  async proposeTiDefinition(proposalId: string, leaderNodeId: string): Promise<PbftMessage> {
    const privateKey = this.privateKeys[leaderNodeId]
    if (!privateKey) {
      throw new PbftValidationError('missing-private-key', `missing private key for node ${leaderNodeId}`)
    }
    if (!this.publicKeys[leaderNodeId]) {
      this.publicKeys[leaderNodeId] = bytesToHex(await getPublicKeyAsync(hexToBytes(privateKey)))
    }
    const toSign: PbftMessageToSign = {
      proposalId,
      viewNo: this.viewNo,
      nodeId: leaderNodeId,
      phase: 'pre-prepare',
      at: new Date().toISOString(),
    }
    const msg: PbftMessage = {
      ...toSign,
      signature: await signPbftMessage(toSign, privateKey),
    }
    await this.append(msg, 'pre-prepare')
    return msg
  }

  async onPrePrepare(msg: PbftMessage): Promise<boolean> {
    await this.append(msg, 'pre-prepare')
    return true
  }

  async onPrepare(msg: PbftMessage): Promise<boolean> {
    await this.append(msg, 'prepare')
    return true
  }

  async onCommit(msg: PbftMessage): Promise<boolean> {
    await this.append(msg, 'commit')
    return true
  }

  async onViewChange(nodeId: string): Promise<PbftMessage> {
    this.viewNo += 1
    const privateKey = this.privateKeys[nodeId]
    if (!privateKey) {
      throw new PbftValidationError('missing-private-key', `missing private key for node ${nodeId}`)
    }
    if (!this.publicKeys[nodeId]) {
      this.publicKeys[nodeId] = bytesToHex(await getPublicKeyAsync(hexToBytes(privateKey)))
    }
    const toSign: PbftMessageToSign = {
      proposalId: `view-change-${this.viewNo}`,
      viewNo: this.viewNo,
      nodeId,
      phase: 'view-change',
      at: new Date().toISOString(),
    }
    const msg: PbftMessage = {
      ...toSign,
      signature: await signPbftMessage(toSign, privateKey),
    }
    await this.append(msg, 'view-change')
    return msg
  }

  commitIfThreshold(proposalId: string): boolean {
    const messages = this.log.get(proposalId) ?? []
    const hasPrePrepare = messages.some((m) => m.phase === 'pre-prepare')
    if (!hasPrePrepare) return false
    const prepares = new Set(messages.filter((m) => m.phase === 'prepare').map((m) => m.nodeId))
    const commits = new Set(messages.filter((m) => m.phase === 'commit').map((m) => m.nodeId))
    return prepares.size >= this.options.threshold && commits.size >= this.options.threshold
  }

  currentView(): number {
    return this.viewNo
  }

  private async append(msg: PbftMessage, phase: PbftPhase): Promise<void> {
    if (!this.options.replicaSet.includes(msg.nodeId)) {
      throw new PbftValidationError('unknown-node', `node ${msg.nodeId} not in replica set`)
    }
    if (msg.phase !== phase) {
      throw new PbftValidationError('invalid-phase', `expected phase ${phase}, received ${msg.phase}`)
    }
    const publicKey = this.publicKeys[msg.nodeId]
    if (!publicKey || !(await verifyPbftMessageSignature(msg, publicKey))) {
      throw new PbftValidationError('invalid-signature', `invalid PBFT signature from node ${msg.nodeId}`)
    }
    const arr = this.log.get(msg.proposalId) ?? []
    if (arr.find((m) => m.nodeId === msg.nodeId && m.phase === msg.phase && m.viewNo === msg.viewNo)) return
    arr.push(msg)
    this.log.set(msg.proposalId, arr)
  }
}
