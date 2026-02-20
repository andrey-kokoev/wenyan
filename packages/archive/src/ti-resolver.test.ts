import { describe, expect, it, vi } from 'vitest'
import { TiResolver } from './ti-resolver'
import type { ArchiveRepository, TiDefinitionRecord } from './index'

function fakeArchive(result: TiDefinitionRecord | undefined): ArchiveRepository {
  const getCurrentTiDefinition = vi.fn(async () => result)
  return {
    appendMessage: vi.fn(),
    appendTransition: vi.fn(),
    appendSeal: vi.fn(),
    enqueueDocket: vi.fn(),
    dequeueDocket: vi.fn(),
    snapshotState: vi.fn(),
    getMessage: vi.fn(),
    getTransitions: vi.fn(),
    getSeals: vi.fn(),
    getIdempotency: vi.fn(),
    putIdempotency: vi.fn(),
    addOfficeApproval: vi.fn(),
    getOfficeApprovals: vi.fn(),
    stateAt: vi.fn(),
    getActiveGenreSchema: vi.fn(),
    getCurrentTiDefinition,
    getCurrentLaw: vi.fn(),
    getLawSet: vi.fn(),
    getConstitutionalDocuments: vi.fn(),
    getMerkleRoot: vi.fn(),
    getMerkleProof: vi.fn(),
    getSyncRange: vi.fn(),
    upsertContentBlob: vi.fn(),
    getContentBlob: vi.fn(),
    appendGossipLog: vi.fn(),
  } as unknown as ArchiveRepository
}

describe('ti resolver', () => {
  it('caches by genre within ttl', async () => {
    const archive = fakeArchive({
      messageId: 'ti-petition',
      targetGenre: 'petition',
      version: '1.0.0',
      schema: { type: 'object' },
      sealedAt: new Date().toISOString(),
    })
    const resolver = new TiResolver(archive, { ttlSeconds: 60 })
    const first = await resolver.getCurrentTiDefinition('petition')
    const second = await resolver.getCurrentTiDefinition('petition')
    expect(first?.messageId).toBe('ti-petition')
    expect(second?.messageId).toBe('ti-petition')
  })
})
