import type { ArchiveRepository, TiDefinitionRecord } from './index'

type CacheEntry = {
  expiresAtMs: number
  value: TiDefinitionRecord | undefined
}

export interface TiResolverOptions {
  ttlSeconds?: number
}

export class TiResolver {
  private readonly ttlSeconds: number
  private cache = new Map<string, CacheEntry>()

  constructor(private readonly archive: ArchiveRepository, options: TiResolverOptions = {}) {
    this.ttlSeconds = options.ttlSeconds ?? 60
  }

  invalidate(genre?: string): void {
    if (!genre) {
      this.cache.clear()
      return
    }
    this.cache.delete(genre)
  }

  async getCurrentTiDefinition(genre: string, atIso = new Date().toISOString()): Promise<TiDefinitionRecord | undefined> {
    const nowMs = Date.now()
    const cached = this.cache.get(genre)
    if (cached && cached.expiresAtMs > nowMs) return cached.value

    const value = await this.archive.getCurrentTiDefinition(genre, atIso)
    this.cache.set(genre, {
      value,
      expiresAtMs: nowMs + this.ttlSeconds * 1000,
    })
    return value
  }
}
