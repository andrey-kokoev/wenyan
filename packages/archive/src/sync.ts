import type { ArchiveRepository } from './index'

export interface SyncRemote {
  getMerkleRoot(scope?: 'all' | 'constitutional' | 'legislative'): Promise<string>
  getSyncRange(fromCursor: string, limit: number): Promise<Array<Record<string, unknown>>>
}

export interface SyncResult {
  localRoot: string
  remoteRoot: string
  diverged: boolean
  fetched: number
}

export async function syncWithPeer(
  local: ArchiveRepository,
  remote: SyncRemote,
  options: { fromCursor?: string; limit?: number; scope?: 'all' | 'constitutional' | 'legislative' } = {},
): Promise<SyncResult> {
  const scope = options.scope ?? 'all'
  const localRoot = await local.getMerkleRoot(scope)
  const remoteRoot = await remote.getMerkleRoot(scope)
  if (localRoot === remoteRoot) {
    return { localRoot, remoteRoot, diverged: false, fetched: 0 }
  }
  const fromCursor = options.fromCursor ?? '0'
  const limit = options.limit ?? 200
  const range = await remote.getSyncRange(fromCursor, limit)
  return {
    localRoot,
    remoteRoot,
    diverged: true,
    fetched: range.length,
  }
}
