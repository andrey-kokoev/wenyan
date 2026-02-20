import { ThemeSchema, ThemeRegistryEntrySchema, type Theme, type ThemeRegistryEntry } from "@wenyan/shared"

const themeCache = new Map<string, Theme>()
let registryCache: ThemeRegistryEntry[] | null = null

export function clearThemeRegistryCache() {
  registryCache = null
}

export async function fetchThemeRegistry(): Promise<ThemeRegistryEntry[]> {
  if (registryCache) return registryCache
  const response = await fetch("/api/themes")
  if (!response.ok) {
    throw new Error(`Failed to fetch theme registry: ${response.status}`)
  }
  const data = await response.json()
  const parsed = ThemeRegistryEntrySchema.array().safeParse(data)
  if (!parsed.success) {
    throw new Error("Theme registry validation failed")
  }
  registryCache = parsed.data
  return parsed.data
}

export async function fetchThemeById(themeId: string): Promise<Theme> {
  const cached = themeCache.get(themeId)
  if (cached) return cached

  const response = await fetch(`/api/themes/${encodeURIComponent(themeId)}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch theme ${themeId}: ${response.status}`)
  }
  const data = await response.json()
  const parsed = ThemeSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`Theme ${themeId} validation failed`)
  }
  themeCache.set(themeId, parsed.data)
  return parsed.data
}

export async function createTheme(theme: Theme): Promise<ThemeRegistryEntry> {
  const response = await fetch("/api/themes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(theme),
  })
  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as any
    const message =
      errorData?.error?.message ||
      errorData?.error ||
      `Failed to create theme (HTTP ${response.status})`
    throw new Error(message)
  }
  const data = (await response.json()) as any
  const parsed = ThemeRegistryEntrySchema.safeParse(data.data ?? data)
  if (!parsed.success) {
    throw new Error("Theme registry entry validation failed")
  }
  registryCache = null
  themeCache.set(theme.id, theme)
  return parsed.data
}

export async function updateTheme(theme: Theme): Promise<void> {
  const response = await fetch(`/api/themes/${encodeURIComponent(theme.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(theme),
  })
  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as any
    const message =
      errorData?.error?.message ||
      errorData?.error ||
      `Failed to update theme (HTTP ${response.status})`
    throw new Error(message)
  }
  registryCache = null
  themeCache.set(theme.id, theme)
}
