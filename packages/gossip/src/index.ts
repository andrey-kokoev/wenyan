/** @public Frozen in v1.x */
export type MembershipState = 'alive' | 'suspect' | 'dead'

export interface MemberRecord {
  nodeId: string
  address: string
  state: MembershipState
  lastSeenAt: string
}

export interface GossipEvent {
  type: 'node.suspect' | 'node.dead' | 'seal.received' | 'digest.mismatch' | 'broadcast.delivered'
  nodeId?: string
  messageId?: string
  at: string
  payload?: Record<string, unknown>
}

/** @public Frozen in v1.x */
export interface MembershipService {
  upsert(nodeId: string, address: string): void
  heartbeat(nodeId: string): void
  suspect(nodeId: string): void
  markDead(nodeId: string): void
  list(): MemberRecord[]
  isPartitioned(): boolean
}

/** @public Frozen in v1.x */
export class SwimMembership implements MembershipService {
  private readonly members = new Map<string, MemberRecord>()

  constructor(private readonly suspicionTimeoutMs = 5000) {}

  upsert(nodeId: string, address: string): void {
    const prev = this.members.get(nodeId)
    this.members.set(nodeId, {
      nodeId,
      address,
      state: prev?.state ?? 'alive',
      lastSeenAt: new Date().toISOString(),
    })
  }

  heartbeat(nodeId: string): void {
    const m = this.members.get(nodeId)
    if (!m) return
    m.state = 'alive'
    m.lastSeenAt = new Date().toISOString()
    this.members.set(nodeId, m)
  }

  suspect(nodeId: string): void {
    const m = this.members.get(nodeId)
    if (!m) return
    m.state = 'suspect'
    this.members.set(nodeId, m)
  }

  markDead(nodeId: string): void {
    const m = this.members.get(nodeId)
    if (!m) return
    m.state = 'dead'
    this.members.set(nodeId, m)
  }

  list(): MemberRecord[] {
    const now = Date.now()
    for (const [k, m] of this.members) {
      if (m.state === 'alive') {
        const age = now - new Date(m.lastSeenAt).getTime()
        if (age > this.suspicionTimeoutMs) {
          m.state = 'suspect'
          this.members.set(k, m)
        }
      }
    }
    return [...this.members.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId))
  }

  isPartitioned(): boolean {
    return this.list().some((m) => m.state !== 'alive')
  }
}

/** @public Frozen in v1.x */
export interface BroadcastMessage {
  id: string
  topic: string
  payload: Record<string, unknown>
  traceparent?: string
  tracestate?: string
}

/** @public Frozen in v1.x */
export interface PlumtreeBroadcast {
  eagerPush(message: BroadcastMessage): string[]
  lazyDigest(digestIds: string[]): string[]
}

/** @public Frozen in v1.x */
export class InMemoryPlumtree implements PlumtreeBroadcast {
  private readonly seen = new Set<string>()

  constructor(private readonly fanout = 3) {}

  eagerPush(message: BroadcastMessage): string[] {
    this.seen.add(message.id)
    const recipients: string[] = []
    for (let i = 0; i < this.fanout; i += 1) recipients.push(`peer-${i + 1}`)
    return recipients
  }

  lazyDigest(digestIds: string[]): string[] {
    return digestIds.filter((id) => !this.seen.has(id))
  }
}

/** @public Frozen in v1.x */
export class ImperialBroadcast {
  private readonly delivered = new Set<string>()

  deliver(message: BroadcastMessage): boolean {
    if (this.delivered.has(message.id)) return false
    this.delivered.add(message.id)
    return true
  }

  deliveredCount(): number {
    return this.delivered.size
  }
}
