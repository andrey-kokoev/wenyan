import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { z } from "zod"
import { DEVICE_SETTINGS_STORAGE_KEY } from "@/utils/constants"

// Device Settings Schema (client-side only, localStorage)
export const DeviceSettingsSchema = z.object({
  sidebarCollapsed: z.boolean().default(false),
  leftRailVisible: z.boolean().default(true),
  rightRailVisible: z.boolean().default(false),
  lastWorkspaceId: z.number().optional(),
  lastProjectId: z.number().optional(),
  customShortcuts: z.record(z.string()).default({}),
})

export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>

function loadSettings(): DeviceSettings {
  try {
    const stored = localStorage.getItem(DEVICE_SETTINGS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const result = DeviceSettingsSchema.safeParse(parsed)
      if (result.success) {
        return result.data
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return DeviceSettingsSchema.parse({})
}

function saveSettings(settings: DeviceSettings) {
  try {
    localStorage.setItem(DEVICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore localStorage errors
  }
}

export const useDeviceSettingsStore = defineStore("deviceSettings", () => {
  // State
  const settings = ref<DeviceSettings>(loadSettings())

  // Getters
  const isSidebarCollapsed = computed(() => settings.value.sidebarCollapsed)
  const isLeftRailVisible = computed(() => settings.value.leftRailVisible)
  const isRightRailVisible = computed(() => settings.value.rightRailVisible)
  const lastWorkspaceId = computed(() => settings.value.lastWorkspaceId)
  const lastProjectId = computed(() => settings.value.lastProjectId)

  // Actions
  function updateSettings(partial: Partial<DeviceSettings>) {
    settings.value = { ...settings.value, ...partial }
    saveSettings(settings.value)
  }

  function setSidebarCollapsed(collapsed: boolean) {
    updateSettings({ sidebarCollapsed: collapsed })
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed(!settings.value.sidebarCollapsed)
  }

  function setLeftRailVisible(visible: boolean) {
    updateSettings({ leftRailVisible: visible })
  }

  function toggleLeftRail() {
    setLeftRailVisible(!settings.value.leftRailVisible)
  }

  function setRightRailVisible(visible: boolean) {
    updateSettings({ rightRailVisible: visible })
  }

  function toggleRightRail() {
    setRightRailVisible(!settings.value.rightRailVisible)
  }

  function setLastWorkspaceId(id: number | undefined) {
    updateSettings({ lastWorkspaceId: id })
  }

  function setLastProjectId(id: number | undefined) {
    updateSettings({ lastProjectId: id })
  }

  function setCustomShortcut(key: string, value: string) {
    updateSettings({
      customShortcuts: {
        ...settings.value.customShortcuts,
        [key]: value,
      },
    })
  }

  function removeCustomShortcut(key: string) {
    const { [key]: _, ...rest } = settings.value.customShortcuts
    updateSettings({ customShortcuts: rest })
  }

  return {
    // State
    settings,
    // Getters
    isSidebarCollapsed,
    isLeftRailVisible,
    isRightRailVisible,
    lastWorkspaceId,
    lastProjectId,
    // Actions
    updateSettings,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    setLeftRailVisible,
    toggleLeftRail,
    setRightRailVisible,
    toggleRightRail,
    setLastWorkspaceId,
    setLastProjectId,
    setCustomShortcut,
    removeCustomShortcut,
  }
})
