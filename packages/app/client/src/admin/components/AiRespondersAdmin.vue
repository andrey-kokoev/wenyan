<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue"
import { Icon } from "@iconify/vue"
import { useToast } from "@/composables/useToast"
import { useAdminAiRespondersStore } from "@/stores/adminAiResponders"
import type { AiPurpose, AiResponder } from "@wenyan/shared"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const store = useAdminAiRespondersStore()
const { success, error: showError } = useToast()
const props = withDefaults(defineProps<{ mode?: "providers" | "responders" | "combined" }>(), {
  mode: "combined",
})

type ProviderKey = "anthropic" | "huggingface" | "moonshot"
type ProviderConfigKey = `${ProviderKey}BaseUrl` | `${ProviderKey}ApiKey`

const responderForm = reactive({
  purpose: "issue_analysis" as AiPurpose,
  providerKey: "",
  model: "",
  modelType: "chat" as AiResponder["modelType"],
  maxOutputTokens: null as number | null,
  settingsJson: "",
  sortOrder: 0,
})

const editResponder = ref<AiResponder | null>(null)
const isResponderDialogOpen = ref(false)
const isDeleteResponderOpen = ref(false)
const deletingResponder = ref<AiResponder | null>(null)
const expandedProviders = ref<string[]>([])
const configLoading = ref(false)
const providerConfig = reactive<Record<ProviderConfigKey, string>>({
  anthropicBaseUrl: "",
  anthropicApiKey: "",
  huggingfaceBaseUrl: "",
  huggingfaceApiKey: "",
  moonshotBaseUrl: "",
  moonshotApiKey: "",
})
const keyHints = reactive<Record<ProviderKey, string>>({
  anthropic: "",
  huggingface: "",
  moonshot: "",
})
const keyEditing = reactive<Record<ProviderKey, boolean>>({
  anthropic: false,
  huggingface: false,
  moonshot: false,
})
const apiBaseUrl = computed(() => import.meta.env.VITE_API_URL || "")

const responderRows = computed(() => store.responders)

const purposeOptions: Array<{ value: AiPurpose; label: string }> = [
  { value: "rule_generation", label: "Rule generation" },
  { value: "rule_duplicate_check", label: "Rule duplicate check" },
  { value: "issue_analysis", label: "Issue analysis" },
]

const purposeLabel = (purpose: AiPurpose) =>
  purposeOptions.find((option) => option.value === purpose)?.label ?? purpose

const requiredPurposeKeys = computed(() => purposeOptions.map((option) => option.value))

const coverageByProvider = computed(() => {
  const map = new Map<string, Set<AiPurpose>>()
  for (const responder of responderRows.value) {
    const set = map.get(responder.providerKey) || new Set<AiPurpose>()
    set.add(responder.purpose)
    map.set(responder.providerKey, set)
  }
  return map
})

const providerCoverageRows = computed(() => {
  const keys = Array.from(coverageByProvider.value.keys()).sort((a, b) => a.localeCompare(b))
  const required = requiredPurposeKeys.value
  return keys.map((providerKey) => {
    const covered = coverageByProvider.value.get(providerKey) || new Set<AiPurpose>()
    const missing = required.filter((purpose) => !covered.has(purpose))
    return {
      providerKey,
      complete: missing.length === 0,
      missing,
    }
  })
})

const incompleteProviderSummary = computed(() => {
  return providerCoverageRows.value
    .filter((row) => !row.complete)
    .map((row) => ({
      providerKey: row.providerKey,
      missing: row.missing.map((purpose) => purposeLabel(purpose)),
    }))
})

const providerRows = computed(() => {
  return providerCoverageRows.value.map((row) => ({
    ...row,
    responders: responderRows.value
      .filter((responder) => responder.providerKey === row.providerKey)
      .sort((a, b) => a.purpose.localeCompare(b.purpose) || a.id - b.id),
  }))
})

function resetResponderForm() {
  responderForm.purpose = "issue_analysis"
  responderForm.providerKey = ""
  responderForm.model = ""
  responderForm.modelType = "chat"
  responderForm.maxOutputTokens = null
  responderForm.settingsJson = ""
  responderForm.sortOrder = 0
}

function hasProviderCredentials(providerKey: string) {
  return ["anthropic", "huggingface", "moonshot"].includes(providerKey)
}

const showRespondersPanel = computed(
  () => props.mode === "responders" || props.mode === "combined",
)
const showCredentialsPanel = computed(
  () => props.mode === "providers" || props.mode === "combined",
)
const isProvidersOnlyMode = computed(() => props.mode === "providers")

function maskedKeyPlaceholder(providerKey: ProviderKey) {
  return keyHints[providerKey] && !keyEditing[providerKey] ? "*".repeat(64) : ""
}

function handleKeyFocus(providerKey: ProviderKey) {
  if (!keyEditing[providerKey]) {
    providerConfig[`${providerKey}ApiKey`] = ""
    keyEditing[providerKey] = true
  }
}

function handleKeyBlur(providerKey: ProviderKey) {
  if (!providerConfig[`${providerKey}ApiKey`].trim() && keyHints[providerKey]) {
    keyEditing[providerKey] = false
  }
}

async function refreshResponders() {
  await store.fetchAll()
}

function openCreateResponder(providerKey?: string) {
  editResponder.value = null
  resetResponderForm()
  if (providerKey) {
    responderForm.providerKey = providerKey
  }
  isResponderDialogOpen.value = true
}

function openEditResponder(responder: AiResponder) {
  editResponder.value = responder
  responderForm.purpose = responder.purpose
  responderForm.providerKey = responder.providerKey
  responderForm.model = responder.model
  responderForm.modelType = responder.modelType
  responderForm.maxOutputTokens = responder.maxOutputTokens ?? null
  responderForm.settingsJson = responder.settingsJson ?? ""
  responderForm.sortOrder = responder.sortOrder
  isResponderDialogOpen.value = true
}

function confirmDeleteResponder(responder: AiResponder) {
  deletingResponder.value = responder
  isDeleteResponderOpen.value = true
}

function isProviderExpanded(providerKey: string) {
  return expandedProviders.value.includes(providerKey)
}

function toggleProviderExpanded(providerKey: string) {
  if (isProviderExpanded(providerKey)) {
    expandedProviders.value = expandedProviders.value.filter((key) => key !== providerKey)
    return
  }
  expandedProviders.value = [...expandedProviders.value, providerKey]
}

async function loadProviderConfig() {
  configLoading.value = true
  try {
    const baseUrl = apiBaseUrl.value
    const url = baseUrl === "/" || baseUrl === ""
      ? "/api/admin/config"
      : `${baseUrl}/api/admin/config`
    const response = await fetch(url, { credentials: "include" })
    if (!response.ok) {
      throw new Error(`Failed to load config (HTTP ${response.status})`)
    }
    const payload = (await response.json()) as {
      data?: {
        anthropicBaseUrl?: string | null
        anthropicApiKey?: string | null
        huggingfaceBaseUrl?: string | null
        huggingfaceApiKey?: string | null
        moonshotBaseUrl?: string | null
        moonshotApiKey?: string | null
      }
    }
    providerConfig.anthropicBaseUrl = payload.data?.anthropicBaseUrl ?? ""
    providerConfig.huggingfaceBaseUrl = payload.data?.huggingfaceBaseUrl ?? ""
    providerConfig.moonshotBaseUrl = payload.data?.moonshotBaseUrl ?? ""
    providerConfig.anthropicApiKey = ""
    providerConfig.huggingfaceApiKey = ""
    providerConfig.moonshotApiKey = ""
    keyHints.anthropic = payload.data?.anthropicApiKey ? "API key is set. Leave blank to keep it unchanged." : ""
    keyHints.huggingface = payload.data?.huggingfaceApiKey ? "API key is set. Leave blank to keep it unchanged." : ""
    keyHints.moonshot = payload.data?.moonshotApiKey ? "API key is set. Leave blank to keep it unchanged." : ""
    keyEditing.anthropic = false
    keyEditing.huggingface = false
    keyEditing.moonshot = false
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load provider config"
    showError("Failed to load config", message)
  } finally {
    configLoading.value = false
  }
}

async function saveProviderConfig(providerKey: ProviderKey) {
  configLoading.value = true
  try {
    const baseUrl = apiBaseUrl.value
    const url = baseUrl === "/" || baseUrl === ""
      ? "/api/admin/config"
      : `${baseUrl}/api/admin/config`
    const payload: Record<string, string> = {}
    const baseUrlKey = `${providerKey}BaseUrl` as ProviderConfigKey
    const apiKeyKey = `${providerKey}ApiKey` as ProviderConfigKey
    if (providerConfig[baseUrlKey].trim()) {
      payload[baseUrlKey] = providerConfig[baseUrlKey].trim()
    }
    if (keyEditing[providerKey] && providerConfig[apiKeyKey].trim()) {
      payload[apiKeyKey] = providerConfig[apiKeyKey].trim()
    }
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`Failed to save config (HTTP ${response.status})`)
    }
    success("Configuration saved", "Provider credentials updated.")
    await loadProviderConfig()
  } catch (error) {
    showError("Failed to save config", error instanceof Error ? error.message : "Unknown error")
  } finally {
    configLoading.value = false
  }
}

async function handleDeleteResponder() {
  if (!deletingResponder.value) return
  try {
    await store.deleteResponder(deletingResponder.value.id)
    success("Responder deleted")
    isDeleteResponderOpen.value = false
    deletingResponder.value = null
    await refreshResponders()
  } catch (err) {
    showError("Failed to delete responder", String(err))
  }
}

async function handleSaveResponder() {
  try {
    if (editResponder.value) {
      await store.updateResponder(editResponder.value.id, {
        purpose: responderForm.purpose,
        providerKey: responderForm.providerKey.trim(),
        model: responderForm.model.trim(),
        modelType: responderForm.modelType,
        maxOutputTokens: Number.isFinite(responderForm.maxOutputTokens)
          ? responderForm.maxOutputTokens
          : null,
        settingsJson: responderForm.settingsJson.trim() || null,
        sortOrder: responderForm.sortOrder,
      })
      success("Responder updated")
    } else {
      await store.createResponder({
        purpose: responderForm.purpose,
        providerKey: responderForm.providerKey.trim(),
        model: responderForm.model.trim(),
        modelType: responderForm.modelType,
        maxOutputTokens: Number.isFinite(responderForm.maxOutputTokens)
          ? responderForm.maxOutputTokens
          : null,
        settingsJson: responderForm.settingsJson.trim() || null,
        sortOrder: responderForm.sortOrder,
      })
      success("Responder created")
    }

    resetResponderForm()
    isResponderDialogOpen.value = false
    editResponder.value = null
    await refreshResponders()
  } catch (err) {
    showError("Failed to save responder", String(err))
  }
}

onMounted(async () => {
  await refreshResponders()
  await loadProviderConfig()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">
          {{ mode === "providers" ? "AI Providers" : "AI Responders" }}
        </h2>
        <p class="text-sm text-muted-foreground">
          {{
            mode === "providers"
              ? "Manage provider-level credentials on top of responder coverage."
              : "Map internal AI purposes to providers and models."
          }}
        </p>
      </div>
      <Button @click="openCreateResponder">Add Responder</Button>
    </div>

    <Alert v-if="incompleteProviderSummary.length" variant="destructive">
      <AlertTitle>Incomplete responder coverage</AlertTitle>
      <AlertDescription class="space-y-2">
        <div class="text-sm">
          The following providers are missing responders for one or more purposes:
        </div>
        <div v-for="item in incompleteProviderSummary" :key="item.providerKey" class="text-sm">
          {{ item.providerKey }}: missing {{ item.missing.join(", ") }}
        </div>
      </AlertDescription>
    </Alert>

    <Card>
      <CardHeader>
        <CardTitle>Providers</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-16"></TableHead>
              <TableHead>Provider</TableHead>
              <TableHead v-if="!isProvidersOnlyMode">Coverage</TableHead>
              <TableHead v-if="!isProvidersOnlyMode">Responders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="row in providerRows" :key="row.providerKey">
              <TableRow>
                <TableCell>
                  <Button size="sm" variant="ghost" @click="toggleProviderExpanded(row.providerKey)">
                    <template v-if="row.missing.length">
                      <span
                        class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive/15 px-2 text-xs font-semibold text-destructive">
                        {{ row.missing.length }}
                      </span>
                    </template>
                    <Icon v-else
                      :icon="isProviderExpanded(row.providerKey) ? 'heroicons:chevron-down' : 'heroicons:chevron-right'"
                      class="h-4 w-4" />
                    <span class="sr-only">
                      {{ isProviderExpanded(row.providerKey) ? "Collapse" : "Expand" }}
                    </span>
                  </Button>
                </TableCell>
                <TableCell class="font-medium">{{ row.providerKey }}</TableCell>
                <TableCell v-if="!isProvidersOnlyMode">
                  <span :class="row.complete ? 'text-emerald-600' : 'text-amber-600'" class="text-sm font-semibold">
                    {{ row.complete ? "Complete" : "Incomplete" }}
                  </span>
                </TableCell>
                <TableCell v-if="!isProvidersOnlyMode" class="text-sm text-muted-foreground">
                  <div class="flex items-center justify-between gap-2">
                    <span>{{ row.responders.length }}</span>
                    <Button size="sm" variant="ghost" @click="openCreateResponder(row.providerKey)">
                      Add responder
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow v-if="isProviderExpanded(row.providerKey)">
                <TableCell :colspan="isProvidersOnlyMode ? 2 : 4" class="bg-muted/30">
                  <div v-if="showCredentialsPanel && hasProviderCredentials(row.providerKey)"
                    class="rounded-md bg-background p-4">
                    <div v-if="row.providerKey === 'anthropic'" class="space-y-3">
                      <div class="space-y-2">
                        <Label>Anthropic Base URL</Label>
                        <Input v-model="providerConfig.anthropicBaseUrl" placeholder="https://api.anthropic.com"
                          :disabled="configLoading" />
                      </div>
                      <div class="space-y-2">
                        <Label>Anthropic API Key</Label>
                        <Input v-model="providerConfig.anthropicApiKey" type="password"
                          :placeholder="maskedKeyPlaceholder('anthropic') || 'Enter a new key to update'"
                          :disabled="configLoading" @focus="handleKeyFocus('anthropic')"
                          @blur="handleKeyBlur('anthropic')" />
                        <p v-if="keyHints.anthropic" class="text-xs text-muted-foreground">
                          {{ keyHints.anthropic }}
                        </p>
                      </div>
                    </div>
                    <div v-else-if="row.providerKey === 'huggingface'" class="space-y-3">
                      <div class="space-y-2">
                        <Label>Hugging Face Base URL</Label>
                        <Input v-model="providerConfig.huggingfaceBaseUrl"
                          placeholder="https://router.huggingface.co/v1" :disabled="configLoading" />
                      </div>
                      <div class="space-y-2">
                        <Label>Hugging Face API Key</Label>
                        <Input v-model="providerConfig.huggingfaceApiKey" type="password"
                          :placeholder="maskedKeyPlaceholder('huggingface') || 'Enter a new key to update'"
                          :disabled="configLoading" @focus="handleKeyFocus('huggingface')"
                          @blur="handleKeyBlur('huggingface')" />
                        <p v-if="keyHints.huggingface" class="text-xs text-muted-foreground">
                          {{ keyHints.huggingface }}
                        </p>
                      </div>
                    </div>
                    <div v-else-if="row.providerKey === 'moonshot'" class="space-y-3">
                      <div class="space-y-2">
                        <Label>Moonshot Base URL</Label>
                        <Input v-model="providerConfig.moonshotBaseUrl" placeholder="https://api.moonshot.ai/v1"
                          :disabled="configLoading" />
                      </div>
                      <div class="space-y-2">
                        <Label>Moonshot API Key</Label>
                        <Input v-model="providerConfig.moonshotApiKey" type="password"
                          :placeholder="maskedKeyPlaceholder('moonshot') || 'Enter a new key to update'"
                          :disabled="configLoading" @focus="handleKeyFocus('moonshot')"
                          @blur="handleKeyBlur('moonshot')" />
                        <p v-if="keyHints.moonshot" class="text-xs text-muted-foreground">
                          {{ keyHints.moonshot }}
                        </p>
                      </div>
                    </div>
                    <div class="mt-4 flex justify-end gap-2">
                      <Button variant="outline" size="sm" :disabled="configLoading" @click="loadProviderConfig">
                        Reset
                      </Button>
                      <Button size="sm" :disabled="configLoading"
                        @click="saveProviderConfig(row.providerKey as 'anthropic' | 'huggingface' | 'moonshot')">
                        Save
                      </Button>
                    </div>
                  </div>
                  <div v-else-if="showRespondersPanel" class="rounded-md bg-background">
                    <Table>
                      <TableBody>
                        <TableRow v-for="responder in row.responders" :key="responder.id" class="border-none">
                          <TableCell class="font-medium">{{ purposeLabel(responder.purpose) }}</TableCell>
                          <TableCell class="text-muted-foreground">{{ responder.model }}</TableCell>
                          <TableCell>
                            <div class="flex justify-end gap-1">
                              <Button size="sm" variant="link" class="h-8 w-8 p-0"
                                @click.stop="openEditResponder(responder)">
                                <Icon icon="heroicons:pencil-square" class="h-4 w-4" />
                                <span class="sr-only">Edit</span>
                              </Button>
                              <Button size="sm" variant="link"
                                class="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                @click.stop="confirmDeleteResponder(responder)">
                                <Icon icon="heroicons:trash" class="h-4 w-4" />
                                <span class="sr-only">Delete</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow v-if="!row.responders.length" class="border-none">
                          <TableCell colspan="3" class="text-center text-muted-foreground">
                            No responders configured for this provider.
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div v-else class="rounded-md bg-background p-4 text-sm text-muted-foreground">
                    No panel available for this provider in this view.
                  </div>
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-if="!providerRows.length">
              <TableCell :colspan="isProvidersOnlyMode ? 2 : 4" class="text-center text-muted-foreground">
                No providers configured.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog v-model:open="isResponderDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editResponder ? "Edit Responder" : "Add Responder" }}</DialogTitle>
          <DialogDescription>
            Configure which provider should serve each AI purpose.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-2">
            <Label>Purpose</Label>
            <Select v-model="responderForm.purpose">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in purposeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>Provider Key</Label>
            <Input v-model="responderForm.providerKey" placeholder="cloudflare" />
          </div>
          <div class="space-y-2">
            <Label>Model</Label>
            <Input v-model="responderForm.model" placeholder="@cf/meta/llama-3.1-8b-instruct" />
          </div>
          <div class="space-y-2">
            <Label>Model Type</Label>
            <Select v-model="responderForm.modelType">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="prompt">Prompt</SelectItem>
                <SelectItem value="embedding">Embedding</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>Max Output Tokens</Label>
            <Input :model-value="responderForm.maxOutputTokens ?? ''" type="number" placeholder="1800"
              @update:model-value="(value) => {
                const raw = typeof value === 'number' ? String(value) : value
                responderForm.maxOutputTokens = raw === '' ? null : Number(raw)
              }" />
          </div>
          <div class="space-y-2">
            <Label>Settings JSON</Label>
            <textarea v-model="responderForm.settingsJson"
              class="min-h-30 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder='{"temperature":0.2}' />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="isResponderDialogOpen = false">Cancel</Button>
          <Button @click="handleSaveResponder">
            {{ editResponder ? "Save Changes" : "Create Responder" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="isDeleteResponderOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Responder</DialogTitle>
          <DialogDescription>
            This will remove the responder configuration.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="isDeleteResponderOpen = false">Cancel</Button>
          <Button variant="solid" color="error" @click="handleDeleteResponder">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
