import { ref } from "vue"
import type { ThemeRegistryEntry } from "@wenyan/shared"
import { fetchThemeRegistry, clearThemeRegistryCache } from "@/lib/themeRegistry"

const themes = ref<ThemeRegistryEntry[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasLoaded = false

export function useThemeRegistry() {
  async function loadThemes() {
    if (hasLoaded || isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      themes.value = await fetchThemeRegistry()
      hasLoaded = true
    } catch (err) {
      error.value = `Failed to load theme registry: ${String(err)}`
    } finally {
      isLoading.value = false
    }
  }

  return {
    themes,
    isLoading,
    error,
    loadThemes,
    refresh: async () => {
      clearThemeRegistryCache()
      hasLoaded = false
      await loadThemes()
    },
  }
}
