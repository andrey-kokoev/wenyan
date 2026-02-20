import { ref, watch } from "vue"
import { useColorMode } from "@vueuse/core"
import { storeToRefs } from "pinia"
import type { ThemeMode } from "@wenyan/shared"
import { useUserSettingsStore } from "@/stores/userSettings"
import { applyTheme, clearThemeOverrides } from "@/lib/applyTheme"
import { fetchThemeById } from "@/lib/themeRegistry"
import { defaultTheme } from "@/lib/defaultTheme"

export function useThemePreference() {
  const store = useUserSettingsStore()
  const { settings } = storeToRefs(store)
  const colorMode = useColorMode()
  const suppressColorModePatch = ref(false)
  const activeThemeId = ref<string | null>(null)
  const isThemeLoading = ref(false)
  const themeError = ref<string | null>(null)

  watch(
    () => settings.value?.themeMode,
    (themeMode) => {
      if (themeMode) {
        suppressColorModePatch.value = true
        colorMode.value = themeMode === "system" ? "auto" : themeMode
      }
    },
    { immediate: true },
  )

  watch(
    () => colorMode.value,
    (val) => {
      if (suppressColorModePatch.value) {
        suppressColorModePatch.value = false
        return
      }
      if (!val) return
      const themeMode = val === "auto" ? "system" : val
      if (settings.value?.themeMode === themeMode) return
      if (themeMode === "light" || themeMode === "dark" || themeMode === "system") {
        store.patchSettings({ themeMode })
      }
    },
  )

  async function applyThemeId(themeId: string) {
    isThemeLoading.value = true
    themeError.value = null
    try {
      const theme = await fetchThemeById(themeId)
      applyTheme(theme)
      activeThemeId.value = themeId
      return true
    } catch (err) {
      console.error("Failed to apply theme:", { themeId, err })
      themeError.value = "Unable to apply the selected theme."
      if (!activeThemeId.value) {
        if (defaultTheme) {
          applyTheme(defaultTheme)
        } else {
          clearThemeOverrides()
        }
      }
      return false
    } finally {
      isThemeLoading.value = false
    }
  }

  watch(
    () => settings.value?.themeId,
    async (themeId) => {
      if (!themeId || themeId === activeThemeId.value) return
      await applyThemeId(themeId)
    },
    { immediate: true },
  )

  async function setThemeId(themeId: string) {
    if (!themeId) return false
    const previousThemeId = activeThemeId.value
    const ok = await applyThemeId(themeId)
    if (!ok) return false
    try {
      await store.patchSettings({ themeId })
      return true
    } catch (err) {
      if (previousThemeId && previousThemeId !== themeId) {
        await applyThemeId(previousThemeId)
      }
      themeError.value = String(err)
      return false
    }
  }

  function setThemeMode(themeMode: ThemeMode) {
    if (themeMode === "light" || themeMode === "dark" || themeMode === "system") {
      suppressColorModePatch.value = true
      colorMode.value = themeMode === "system" ? "auto" : themeMode
    }
    return store.setThemeMode(themeMode)
  }

  return {
    colorMode,
    setThemeMode,
    setThemeId,
    isThemeLoading,
    themeError,
  }
}
