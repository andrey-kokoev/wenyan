import { watch, onMounted } from "vue"
import { storeToRefs } from "pinia"
import type { UserSettings, UserSettingsUpdate } from "@wenyan/shared"
import { useSignedInUser } from "@/access-control"
import { useUserSettingsStore } from "@/stores/userSettings"
import { useThemePreference } from "@/composables/useThemePreference"

export function useUserSettings() {
  const { user } = useSignedInUser()
  const store = useUserSettingsStore()
  const { settings, isLoading, error, isAuthenticated } = storeToRefs(store)
  const { setThemeMode, setThemeId } = useThemePreference()

  // Fetch settings when user changes
  watch(
    () => user.value,
    (newUser) => {
      if (newUser && !isLoading.value) {
        store.debouncedFetchSettings()
      }
    },
    { immediate: true },
  )

  // Also fetch on mount if user is already loaded
  onMounted(() => {
    if (user.value && !isLoading.value) {
      store.debouncedFetchSettings()
    }
  })

  function fetchSettings() {
    return store.debouncedFetchSettings()
  }

  function updateSettings(newSettings: UserSettings) {
    return store.updateSettings(newSettings)
  }

  function patchSettings(partialSettings: UserSettingsUpdate) {
    return store.patchSettings(partialSettings)
  }

  return {
    settings,
    isLoading,
    error,
    isAuthenticated,
    fetchSettings,
    updateSettings,
    patchSettings,
    setThemeMode,
    setThemeId,
  }
}
