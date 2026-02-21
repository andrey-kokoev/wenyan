import { createHash } from 'node:crypto'

export interface AuditCheckpoint {
  id: string
  scope: 'all' | 'constitutional' | 'legislative'
  merkleRoot: string
  sealCount: number
  nodeSignatures: string[]
  createdAt: string
}

export interface CheckpointRepository {
  getMerkleRoot(scope?: 'all' | 'constitutional' | 'legislative'): string | Promise<string>
  appendAuditCheckpoint(entry: {
    id?: string
    scope: 'all' | 'constitutional' | 'legislative'
    merkleRoot: string
    sealCount: number
    nodeSignatures: string[]
    createdAt: string
  }): void | Promise<void>
  exportAuditBundle(input: { start?: string; end?: string; merkleRoot?: string }): unknown | Promise<unknown>
}

export class CheckpointService {
  constructor(private readonly repository: CheckpointRepository) {}

  async createCheckpoint(
    scope: 'all' | 'constitutional' | 'legislative' = 'all',
    nodeSignatures: string[] = [],
    sealCount = 0,
  ): Promise<AuditCheckpoint> {
    const merkleRoot = await this.repository.getMerkleRoot(scope)
    const createdAt = new Date().toISOString()
    const id = `checkpoint:${scope}:${createdAt}`
    const checkpoint: AuditCheckpoint = {
      id,
      scope,
      merkleRoot,
      sealCount,
      nodeSignatures,
      createdAt,
    }
    await this.repository.appendAuditCheckpoint({
      id,
      scope,
      merkleRoot,
      sealCount,
      nodeSignatures,
      createdAt,
    })
    return checkpoint
  }

  async exportBundle(input: { start?: string; end?: string; merkleRoot?: string }): Promise<unknown> {
    return this.repository.exportAuditBundle(input)
  }

  verifyBundle(bundle: unknown): boolean {
    if (!bundle || typeof bundle !== 'object') return false
    const typed = bundle as {
      checkpoint?: { merkleRoot?: string }
      digest?: string
      verification_scope?: string
    }
    if (!typed.checkpoint?.merkleRoot || !typed.digest) return false
    if (typed.verification_scope && typed.verification_scope !== 'checkpoint-digest-only') return false
    const actual = createHash('sha256').update(JSON.stringify(typed.checkpoint)).digest('hex')
    return actual === typed.digest
  }
}
