import type { ArchiveRepository } from '@andrey-kokoev/wenyan-archive'
import { EdictLawTypeValues, type EdictLawType, type LawMode, type ResolvedLaw } from '@andrey-kokoev/wenyan-core'

export type LawResolverEventType =
  | 'law.loaded'
  | 'law.missing'
  | 'law.ambiguous'
  | 'law.cache.hit'
  | 'law.cache.miss'

export interface LawResolverEvent {
  type: LawResolverEventType
  lawType?: EdictLawType
  at: string
  detail?: string
}

export interface LawResolverOptions {
  mode?: LawMode
  cacheTtlSeconds?: number
  preloadTypes?: EdictLawType[]
  onEvent?: (event: LawResolverEvent) => void
}

type CacheEntry = {
  expiresAtMs: number
  value: ResolvedLaw | undefined
}

export class LawResolver {
  private readonly mode: LawMode
  private readonly cacheTtlSeconds: number
  private readonly preloadTypes: EdictLawType[]
  private readonly onEvent?: (event: LawResolverEvent) => void
  private cache = new Map<EdictLawType, CacheEntry>()

  constructor(private readonly archive: ArchiveRepository, options: LawResolverOptions = {}) {
    this.mode = options.mode ?? 'strict'
    this.cacheTtlSeconds = options.cacheTtlSeconds ?? 60
    this.preloadTypes = options.preloadTypes ?? ['appointment', 'classification']
    this.onEvent = options.onEvent
  }

  getMode(): LawMode {
    return this.mode
  }

  async preload(atIso = new Date().toISOString()): Promise<void> {
    for (const lawType of this.preloadTypes) {
      await this.get(lawType, atIso)
    }
  }

  invalidate(lawType?: EdictLawType): void {
    if (!lawType) {
      this.cache.clear()
      return
    }
    this.cache.delete(lawType)
  }

  async get(lawType: EdictLawType, atIso = new Date().toISOString()): Promise<ResolvedLaw | undefined> {
    const nowMs = Date.now()
    const cached = this.cache.get(lawType)
    if (cached && cached.expiresAtMs > nowMs) {
      this.emit({ type: 'law.cache.hit', lawType, at: atIso })
      return cached.value
    }

    this.emit({ type: 'law.cache.miss', lawType, at: atIso })
    let law: ResolvedLaw | undefined
    try {
      law = await this.archive.getCurrentLaw(lawType, atIso)
    } catch (error) {
      if (error instanceof Error && error.message === 'ambiguous-law') {
        this.emit({ type: 'law.ambiguous', lawType, at: atIso })
      }
      throw error
    }

    if (!law) {
      this.emit({ type: 'law.missing', lawType, at: atIso })
    } else {
      this.emit({ type: 'law.loaded', lawType, at: atIso, detail: law.messageId })
    }

    this.cache.set(lawType, {
      value: law,
      expiresAtMs: nowMs + this.cacheTtlSeconds * 1000,
    })
    return law
  }

  async getLawSet(atIso = new Date().toISOString()): Promise<Record<EdictLawType, ResolvedLaw | undefined>> {
    const out = {} as Record<EdictLawType, ResolvedLaw | undefined>
    for (const lawType of EdictLawTypeValues) {
      out[lawType] = await this.get(lawType, atIso)
    }
    return out
  }

  private emit(event: LawResolverEvent): void {
    this.onEvent?.(event)
  }
}
