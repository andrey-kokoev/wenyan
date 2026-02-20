import type { EdictLawType } from '@wenyan/core'
import type { LawResolver } from './law-resolver'

export type LawContentLoadResult<T> =
  | { ok: true; content: T | undefined }
  | { ok: false; error: string }

export interface LawContentLoadOptions<T> {
  resolver: LawResolver
  lawType: EdictLawType
  schema: {
    safeParse(input: unknown):
      | { success: true; data: T }
      | { success: false; error?: unknown }
  }
  strictErrors: {
    missing: string
    ambiguous: string
    invalid: string
  }
}

export async function loadLawContent<T>(options: LawContentLoadOptions<T>): Promise<LawContentLoadResult<T>> {
  const { resolver, lawType, schema, strictErrors } = options
  let raw: Record<string, unknown> | undefined

  try {
    const law = await resolver.get(lawType)
    raw = law?.content
  } catch (error) {
    if (error instanceof Error && error.message === 'ambiguous-law') {
      if (resolver.getMode() === 'strict') return { ok: false, error: strictErrors.ambiguous }
      resolver.noteFallback(lawType, 'ambiguous')
      return { ok: true, content: undefined }
    }
    throw error
  }

  if (!raw) {
    if (resolver.getMode() === 'strict') return { ok: false, error: strictErrors.missing }
    resolver.noteFallback(lawType, 'missing')
    return { ok: true, content: undefined }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    if (resolver.getMode() === 'strict') return { ok: false, error: strictErrors.invalid }
    resolver.noteFallback(lawType, 'invalid-content')
    return { ok: true, content: undefined }
  }

  return { ok: true, content: parsed.data }
}
