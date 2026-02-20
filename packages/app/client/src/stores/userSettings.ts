import { defineStore } from "pinia"
import { ref } from "vue"
import { useDebounceFn } from "@vueuse/core"
import type { UserSettings, UserSettingsUpdate } from "@wenyan/shared"

export const useUserSettingsStore = defineStore("userSettings", () => {
  const settings = ref<UserSettings | null>(null)
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const isAuthenticated = ref<boolean>(false)

  async function fetchSettings(): Promise<void> {
    try {
      isLoading.value = true
      error.value = null
      isAuthenticated.value = false

      const response = await fetch("/api/me/settings")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = (await response.json()) as UserSettings
      if (!data) {
        error.value = "No data returned from settings endpoint"
        return
      }
      settings.value = data
      isAuthenticated.value = true
    } catch (err) {
      error.value = String(err)
    } finally {
      isLoading.value = false
    }
  }

  const debouncedFetchSettings = useDebounceFn(fetchSettings, 200)

  async function updateSettings(newSettings: UserSettings): Promise<void> {
    try {
      isLoading.value = true
      error.value = null

      const response = await fetch("/api/me/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const updated = (await response.json()) as { settings: UserSettings }
      if (updated) {
        settings.value = updated.settings
      }
    } catch (err) {
      error.value = String(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function patchSettings(partialSettings: UserSettingsUpdate): Promise<void> {
    try {
      isLoading.value = true
      error.value = null

      const response = await fetch("/api/me/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partialSettings),
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const patched = (await response.json()) as { settings: UserSettings }
      if (patched) {
        settings.value = patched.settings
      }
    } catch (err) {
      error.value = String(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function setThemeMode(themeMode: UserSettings["themeMode"]): Promise<void> {
    await patchSettings({ themeMode })
  }

  return {
    settings,
    isLoading,
    error,
    isAuthenticated,
    debouncedFetchSettings,
    updateSettings,
    patchSettings,
    setThemeMode,
  }
})
