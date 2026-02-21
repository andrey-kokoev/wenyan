import type { EdictLawType } from '@andrey-kokoev/wenyan-core'
import type { LawResolver } from './law-resolver'

export type LawContentLoadResult<T> =
  | { ok: true; content: T | undefined }
  | { ok: false; error: string }

export interface LawContentLoadOptions<T> {
  resolver: LawResolver
  lawType: EdictLawType
  atIso?: string
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
  const { resolver, lawType, atIso, schema, strictErrors } = options
  let raw: Record<string, unknown> | undefined

  try {
    const law = await resolver.get(lawType, atIso)
    raw = law?.content
  } catch (error) {
    if (error instanceof Error && error.message === 'ambiguous-law') {
      return { ok: false, error: strictErrors.ambiguous }
    }
    throw error
  }

  if (!raw) {
    return { ok: false, error: strictErrors.missing }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: strictErrors.invalid }
  }

  return { ok: true, content: parsed.data }
}
