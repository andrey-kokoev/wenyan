<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import type {
  AiAvailableProvider,
  AiAvailableProvidersResponse,
  UserSettings,
} from "@wenyan/shared"
import {
  AiAvailableProvidersResponseSchema,
  ThemeModeValues,
  type ThemeMode,
} from "@wenyan/shared"
import { useUserSettings } from "@/composables/useUserSettings"
import { useThemeRegistry } from "@/composables/useThemeRegistry"
import { useToast } from "@/composables/useToast"
import type { AcceptableValue } from "reka-ui"
import { toSelectString } from "@/lib/selectValue"

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle } from "lucide-vue-next"

const { settings, isLoading, error, setThemeMode, setThemeId, patchSettings } = useUserSettings()
const { themes, isLoading: themesLoading, error: themesError, loadThemes } = useThemeRegistry()
const { error: showError, success: showSuccess } = useToast()

const showSkeleton = computed(() => isLoading.value && !settings.value)

const themeOptions = ThemeModeValues.map((value: ThemeMode) => ({
  label: value.charAt(0).toUpperCase() + value.slice(1),
  value,
}))

const preferredProvider = ref("cloudflare")
const availableProviders = ref<AiAvailableProvider[]>([])
const providersLoading = ref(false)
const providersError = ref<string | null>(null)

const preferredProviderOptions = computed(() => availableProviders.value)
const preferredProviderString = computed(() => preferredProvider.value)

watch(
  () => settings.value,
  (value) => {
    if (!value) return
    preferredProvider.value = value.ai?.preferredProvider ?? "cloudflare"
  },
  { immediate: true },
)

const handleThemeChange = async (theme: UserSettings["themeMode"]) => {
  try {
    await setThemeMode(theme)
  } catch (err) {
    showError("Failed to update theme", String(err))
  }
}

const handleThemeIdChange = async (value: AcceptableValue) => {
  const themeId = toSelectString(value)
  if (!themeId) return
  try {
    const ok = await setThemeId(themeId)
    if (!ok) {
      showError("Failed to apply theme", "Theme could not be loaded from the registry.")
      return
    }
    showSuccess("Theme updated", "Color theme has been applied.")
  } catch (err) {
    showError("Failed to update theme", String(err))
  }
}

const handlePreferredProviderChange = (value: AcceptableValue) => {
  const next = toSelectString(value)
  if (!next) return

  // Validate that the selected provider exists in the loaded provider list
  const exists = availableProviders.value.some((p) => p.key === next)
  if (!exists) {
    providersError.value = `Invalid provider selected: ${next}`
    return
  }

  // Clear any previous provider errors and update the selection
  providersError.value = null
  preferredProvider.value = next
}

const saveAiSettings = async () => {
  try {
    const aiPatch: Partial<UserSettings["ai"]> = {
      preferredProvider: preferredProvider.value.trim() || "cloudflare",
    }

    await patchSettings({ ai: aiPatch })
    showSuccess("AI settings updated", "Preferred provider has been saved.")
  } catch (err) {
    showError("Failed to update AI settings", String(err))
  }
}

const loadAvailableProviders = async () => {
  providersLoading.value = true
  providersError.value = null
  try {
    const response = await fetch("/api/ai/providers")
    if (!response.ok) {
      throw new Error(`Failed to load AI providers (HTTP ${response.status})`)
    }
    const payload = (await response.json()) as AiAvailableProvidersResponse
    const parsed = AiAvailableProvidersResponseSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error("AI provider list validation failed")
    }
    availableProviders.value = parsed.data.data
  } catch (err) {
    providersError.value = String(err)
  } finally {
    providersLoading.value = false
  }
}

watch(
  () => preferredProviderOptions.value,
  (options) => {
    if (!options.length) return
    if (!options.some((option) => option.key === preferredProvider.value)) {
      preferredProvider.value = options[0].key
    }
  },
)

onMounted(() => {
  loadThemes()
  loadAvailableProviders()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <Card v-if="showSkeleton">
      <CardHeader>
        <Skeleton class="h-6 w-32" />
      </CardHeader>
      <CardContent class="space-y-4">
        <Skeleton class="h-10 w-full" />
        <Skeleton class="h-10 w-full" />
      </CardContent>
    </Card>

    <!-- Error State -->
    <Alert v-else-if="error" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertTitle>Error loading settings</AlertTitle>
      <AlertDescription>
        {{ error }}
      </AlertDescription>
    </Alert>

    <!-- Settings Content -->
    <template v-else-if="settings">
      <!-- Appearance / Theme -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <span class="text-xl">🎨</span>
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription> Customize how the application looks </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <Label>Theme Mode</Label>
            <div class="flex flex-wrap gap-2">
              <Button v-for="option in themeOptions" :key="option.value"
                :variant="settings.themeMode === option.value ? 'solid' : 'outline'" size="sm"
                @click="handleThemeChange(option.value)">
                {{ option.label }}
              </Button>
            </div>

            <div class="space-y-2">
              <Label>Color Theme</Label>
              <Select :model-value="settings.themeId" :disabled="themesLoading || !themes.length"
                @update:model-value="handleThemeIdChange">
                <SelectTrigger class="w-full">
                  <SelectValue :placeholder="themesLoading ? 'Loading themes...' : 'Select theme'" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="theme in themes" :key="theme.id" :value="theme.id">
                    {{ theme.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="themesError" class="text-xs text-destructive">
                Failed to load theme registry.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div class="pt-2 text-sm font-semibold text-muted-foreground">
        AI Settings
      </div>

      <!-- AI Settings -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <span class="text-xl">🤖</span>
            <div>
              <CardTitle>AI Preferences</CardTitle>
              <CardDescription>
                Choose your preferred provider. Credentials are managed in Admin.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-4">
            <div class="space-y-4">
              <div class="space-y-2">
                <Label>Preferred Provider</Label>
                <Select :model-value="preferredProviderString"
                  :disabled="providersLoading || !preferredProviderOptions.length"
                  @update:model-value="handlePreferredProviderChange">
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="providersLoading ? 'Loading providers...' : 'Select provider'" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="provider in preferredProviderOptions" :key="provider.key" :value="provider.key">
                      {{ provider.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p class="text-xs text-muted-foreground">
                  Must match a configured AI responder provider key.
                </p>
                <p class="text-xs text-muted-foreground">
                  Provider API keys and base URLs are configured by admins.
                </p>
                <p v-if="providersError" class="text-xs text-destructive">
                  {{ providersError }}
                </p>
                <p v-else-if="!preferredProviderOptions.length" class="text-xs text-muted-foreground">
                  No providers are fully configured for all AI purposes.
                </p>
              </div>
            </div>

            <div class="flex justify-end">
              <Button size="sm" @click="saveAiSettings">Save AI Preferences</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Saving Indicator -->
      <div v-if="isLoading" class="flex items-center justify-center gap-2 text-muted-foreground">
        <span class="animate-spin">⟳</span>
        <span class="text-sm">Saving changes...</span>
      </div>
    </template>
  </div>
</template>
