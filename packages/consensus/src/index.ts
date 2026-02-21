export type PbftPhase = 'pre-prepare' | 'prepare' | 'commit' | 'view-change'

export interface PbftMessage {
  proposalId: string
  viewNo: number
  nodeId: string
  phase: PbftPhase
  signature: string
  at: string
}

export interface PbftOptions {
  replicaSet: string[]
  threshold: number
  viewChangeTimeoutMs?: number
}

export class PbftConsensus {
  private readonly log = new Map<string, PbftMessage[]>()
  private viewNo = 0

  constructor(private readonly options: PbftOptions) {}

  proposeTiDefinition(proposalId: string, leaderNodeId: string): PbftMessage {
    const msg: PbftMessage = {
      proposalId,
      viewNo: this.viewNo,
      nodeId: leaderNodeId,
      phase: 'pre-prepare',
      signature: `${leaderNodeId}:${proposalId}:${this.viewNo}`,
      at: new Date().toISOString(),
    }
    this.append(msg)
    return msg
  }

  onPrePrepare(msg: PbftMessage): boolean {
    return this.append(msg)
  }

  onPrepare(msg: PbftMessage): boolean {
    return this.append({ ...msg, phase: 'prepare' })
  }

  onCommit(msg: PbftMessage): boolean {
    return this.append({ ...msg, phase: 'commit' })
  }

  onViewChange(nodeId: string): PbftMessage {
    this.viewNo += 1
    const msg: PbftMessage = {
      proposalId: `view-change-${this.viewNo}`,
      viewNo: this.viewNo,
      nodeId,
      phase: 'view-change',
      signature: `${nodeId}:view-change:${this.viewNo}`,
      at: new Date().toISOString(),
    }
    this.append(msg)
    return msg
  }

  commitIfThreshold(proposalId: string): boolean {
    const messages = this.log.get(proposalId) ?? []
    const prepares = new Set(messages.filter((m) => m.phase === 'prepare').map((m) => m.nodeId))
    const commits = new Set(messages.filter((m) => m.phase === 'commit').map((m) => m.nodeId))
    return prepares.size >= this.options.threshold && commits.size >= this.options.threshold
  }

  currentView(): number {
    return this.viewNo
  }

  private append(msg: PbftMessage): boolean {
    if (!this.options.replicaSet.includes(msg.nodeId)) return false
    const arr = this.log.get(msg.proposalId) ?? []
    if (arr.find((m) => m.nodeId === msg.nodeId && m.phase === msg.phase && m.viewNo === msg.viewNo)) return false
    arr.push(msg)
    this.log.set(msg.proposalId, arr)
    return true
  }
}
