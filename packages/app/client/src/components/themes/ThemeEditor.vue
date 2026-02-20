<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import {
  ThemeSchema,
  ThemeColorsSchema,
  type Theme,
  type ThemeColors,
} from "@wenyan/shared"
import { useThemeRegistry } from "@/composables/useThemeRegistry"
import { useUserSettings } from "@/composables/useUserSettings"
import { useToast } from "@/composables/useToast"
import { applyTheme } from "@/lib/applyTheme"
import { defaultTheme } from "@/lib/defaultTheme"
import { createTheme, fetchThemeById, updateTheme } from "@/lib/themeRegistry"
import { toSelectString } from "@/lib/selectValue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuthStore } from "@/auth"
import { isAdmin, isDeveloper } from "@wenyan/shared"

type ThemeColorKey = keyof ThemeColors
type EditorMode = "edit" | "clone"

const props = defineProps<{
  mode: EditorMode
}>()

const colorKeys = Object.keys(ThemeColorsSchema.shape) as ThemeColorKey[]

const { themes, isLoading, error, loadThemes, refresh } = useThemeRegistry()
const { settings } = useUserSettings()
const { error: showError, success: showSuccess } = useToast()
const router = useRouter()

const selectedThemeId = ref<string | null>(null)
const draft = ref<Theme | null>(null)
const sourceThemeId = ref<string | null>(null)
const isCloneMode = computed(() => props.mode === "clone")
const pageTitle = computed(() => (isCloneMode.value ? "Clone Theme" : "Edit Theme"))
const pageDescription = computed(() =>
  isCloneMode.value
    ? "Clone themes with schema-driven validation."
    : "Edit themes with schema-driven validation.",
)
const previewEnabled = ref(false)
const previewSnapshot = ref<Theme | null>(null)
const isSaving = ref(false)

const validation = computed(() => {
  if (!draft.value) return { success: true as const, data: null }
  return ThemeSchema.safeParse(draft.value)
})

const errorMap = computed(() => {
  if (validation.value.success || !draft.value) return {}
  const map: Record<string, string> = {}
  for (const issue of validation.value.error.issues) {
    const path = issue.path.join(".")
    map[path] = issue.message
  }
  return map
})

const auth = useAuthStore()

const isElevated = computed(() => {
  const roles = auth.user?.roles ?? []
  return isAdmin(roles) || isDeveloper(roles)
})

const canEdit = computed(() => {
  if (!draft.value || !auth.user) return false
  return isElevated.value || draft.value.createdBy === auth.user.email
})

const canSave = computed(() => {
  if (!draft.value || !validation.value.success) return false
  if (!isCloneMode.value) return canEdit.value
  if (sourceThemeId.value && draft.value.id === sourceThemeId.value) return false
  return true
})

const cloneRequired = computed(() => {
  if (!draft.value || !sourceThemeId.value) return false
  return isCloneMode.value && draft.value.id === sourceThemeId.value
})

function getError(path: string) {
  return errorMap.value[path]
}

function cloneTheme() {
  if (!draft.value || !sourceThemeId.value) return
  const existingIds = new Set(themes.value.map((t) => t.id))
  let index = 1
  let nextId = `${sourceThemeId.value}-copy`
  while (existingIds.has(nextId)) {
    index += 1
    nextId = `${sourceThemeId.value}-copy-${index}`
  }
  draft.value = {
    ...draft.value,
    id: nextId,
    name: `Copy of ${draft.value.name}`,
    createdBy: auth.user?.email ?? draft.value.createdBy,
  }
}

async function loadTheme(id: string) {
  try {
    const theme = await fetchThemeById(id)
    draft.value = structuredClone(theme)
    sourceThemeId.value = id
    if (isCloneMode.value) {
      cloneTheme()
    }
  } catch (err) {
    showError("Failed to load theme", String(err))
  }
}

async function saveTheme() {
  if (!draft.value || !validation.value.success) return
  if (cloneRequired.value) {
    showError("Clone required", "Set a new theme ID before saving.")
    return
  }
  isSaving.value = true
  try {
    if (!isCloneMode.value) {
      await updateTheme(draft.value)
      await refresh()
      showSuccess("Theme updated", `"${draft.value.name}" has been saved.`)
    } else {
      const entry = await createTheme(draft.value)
      await refresh()
      showSuccess("Theme created", `"${entry.name}" is now available.`)
    }
  } catch (err) {
    showError("Failed to save theme", String(err))
  } finally {
    isSaving.value = false
  }
}

async function getCurrentTheme(): Promise<Theme | null> {
  const currentId = settings.value?.themeId
  if (currentId) {
    try {
      return await fetchThemeById(currentId)
    } catch {
      return defaultTheme ?? null
    }
  }
  return defaultTheme ?? null
}

watch(
  () => selectedThemeId.value,
  async (value) => {
    if (!value) return
    await loadTheme(value)
  },
)

watch(
  () => previewEnabled.value,
  async (enabled) => {
    if (enabled) {
      previewSnapshot.value = await getCurrentTheme()
      if (draft.value) {
        applyTheme(draft.value)
      }
      return
    }
    if (previewSnapshot.value) {
      applyTheme(previewSnapshot.value)
    }
  },
)

watch(
  () => draft.value,
  (value) => {
    if (previewEnabled.value && value) {
      applyTheme(value)
    }
  },
  { deep: true },
)

onMounted(async () => {
  await loadThemes()
})
</script>

<template>
  <div class="container mx-auto py-8 px-4">
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ pageTitle }}</h1>
          <p class="text-muted-foreground">{{ pageDescription }}</p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="!isCloneMode"
            variant="link"
            class="px-0"
            @click="router.push('/themes/clone')"
          >
            Go to Clone
          </Button>
          <Button variant="outline" @click="previewEnabled = !previewEnabled">
            {{ previewEnabled ? "Stop Preview" : "Preview Changes" }}
          </Button>
          <Button
            :disabled="!canSave || isSaving"
            @click="saveTheme"
          >
            {{ isSaving ? "Saving..." : isCloneMode ? "Save Clone" : "Save Theme" }}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme Selection</CardTitle>
          <CardDescription>
            {{ isCloneMode ? "Select a theme to clone." : "Select a theme to edit." }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 gap-4 md:items-end">
            <div class="space-y-2">
              <Label>Theme</Label>
              <Select
                :model-value="selectedThemeId"
                :disabled="isLoading || !themes.length"
                @update:model-value="(value) => (selectedThemeId = toSelectString(value))"
              >
                <SelectTrigger class="w-full">
                  <SelectValue
                    :placeholder="isLoading ? 'Loading themes...' : 'Select theme'"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="theme in themes"
                    :key="theme.id"
                    :value="theme.id"
                  >
                    {{ theme.name }} ({{ theme.id }})
                  </SelectItem>
                </SelectContent>
              </Select>
              <p v-if="error" class="text-xs text-destructive">
                {{ error }}
              </p>
            </div>
          </div>

          <p v-if="!isCloneMode && draft && !canEdit" class="text-sm text-warning">
            You can view this theme but cannot edit it. Use the clone page to create your own.
          </p>
          <p v-else-if="cloneRequired" class="text-sm text-warning">
            Clone required: update the theme ID before saving.
          </p>
        </CardContent>
      </Card>

      <Card v-if="draft">
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>Theme identity and version info.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-3">
          <div class="space-y-2">
            <Label for="theme-id">Theme ID</Label>
            <Input id="theme-id" v-model="draft.id" />
            <p v-if="getError('id')" class="text-xs text-destructive">{{ getError('id') }}</p>
          </div>
          <div class="space-y-2">
            <Label for="theme-name">Name</Label>
            <Input id="theme-name" v-model="draft.name" />
            <p v-if="getError('name')" class="text-xs text-destructive">{{ getError('name') }}</p>
          </div>
          <div class="space-y-2">
            <Label for="theme-version">Version</Label>
            <Input id="theme-version" v-model="draft.version" />
            <p v-if="getError('version')" class="text-xs text-destructive">{{ getError('version') }}</p>
          </div>
          <div class="space-y-2">
            <Label>Visibility</Label>
            <Select v-model="draft.visibility">
              <SelectTrigger>
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="getError('visibility')" class="text-xs text-destructive">
              {{ getError('visibility') }}
            </p>
          </div>
          <div class="space-y-2">
            <Label>Created By</Label>
            <Input :model-value="draft.createdBy" disabled />
            <p v-if="getError('createdBy')" class="text-xs text-destructive">
              {{ getError('createdBy') }}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card v-if="draft">
        <CardHeader>
          <CardTitle>Colors</CardTitle>
          <CardDescription>All color tokens for light and dark modes.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div class="text-sm font-medium text-muted-foreground">Token</div>
            <div class="text-sm font-medium text-muted-foreground">Light</div>
            <div class="text-sm font-medium text-muted-foreground">Dark</div>
          </div>
          <div v-for="key in colorKeys" :key="key" class="grid grid-cols-1 gap-4 md:grid-cols-3 items-start">
            <div class="text-sm font-medium">{{ key }}</div>
            <div class="space-y-1">
              <Input v-model="draft.modes.light[key]" />
              <p
                v-if="getError(`modes.light.${key}`)"
                class="text-xs text-destructive"
              >
                {{ getError(`modes.light.${key}`) }}
              </p>
            </div>
            <div class="space-y-1">
              <Input v-model="draft.modes.dark[key]" />
              <p
                v-if="getError(`modes.dark.${key}`)"
                class="text-xs text-destructive"
              >
                {{ getError(`modes.dark.${key}`) }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
