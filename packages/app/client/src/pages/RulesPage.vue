<template>
  <div class="container mx-auto py-8 px-4">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Rules</h1>
          <p class="text-muted-foreground">
            Manage reusable policy and configuration items.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Button v-if="showNewRuleSetButton" variant="outline" @click="showCreateRuleSetDialog = true">
            <Icon icon="heroicons:plus" class="w-4 h-4 mr-2" />
            New Rule set
          </Button>
          <Button v-if="showRuleSetsLink" variant="ghost" @click="goToRuleSets">
            Rule sets
          </Button>
          <Button @click="openCreateRule">
            <Icon icon="heroicons:plus" class="w-4 h-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      <!-- Rules Table -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between gap-4">
            <CardTitle>All Rules</CardTitle>
            <div class="text-right text-xs text-muted-foreground">
              <div v-if="searchQuery.trim()">
                Filtered count: {{ filteredRules.length }}
              </div>
              <div>Total count: {{ rules.length }}</div>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <CardDescription>
              Rules are global and can be linked to workspaces and projects.
            </CardDescription>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="link" size="sm" class="h-8 w-8 p-0" @click="showExportDialog = true">
                  <Icon icon="heroicons:arrow-down-tray" class="h-4 w-4" />
                  <span class="sr-only">Export rules</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export rules</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="showSearch" class="mb-4 max-w-md">
            <Input v-model="searchQuery" placeholder="Search rules..." />
          </div>
          <div v-if="loading" class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>

          <div v-else-if="error" class="text-center py-8">
            <p class="text-destructive">{{ error }}</p>
            <Button variant="outline" class="mt-4" @click="fetchAll">
              Retry
            </Button>
          </div>

          <div v-else-if="rules.length === 0" class="text-center py-8">
            <Icon icon="heroicons:clipboard-document-list" class="w-12 h-12 mx-auto text-muted-foreground" />
            <p class="mt-4 text-muted-foreground">No rules yet.</p>
            <p class="text-sm text-muted-foreground">Create your first rule to get started.</p>
          </div>

          <div v-else-if="filteredRules.length === 0" class="text-center py-8 border rounded-lg">
            <Icon icon="heroicons:magnifying-glass" class="w-12 h-12 mx-auto text-muted-foreground" />
            <p class="mt-4 text-muted-foreground">No rules match your search.</p>
            <p class="text-sm text-muted-foreground">Try a different keyword.</p>
          </div>

          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead v-if="ruleSets.length > 0">Member of Rule sets</TableHead>
                <TableHead>Created</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="rule in filteredRules" :key="rule.id" class="cursor-pointer hover:bg-muted/50"
                @click="editRule(rule)">
                <TableCell class="font-medium">
                  <div class="flex items-center gap-2">
                    <Icon icon="heroicons:clipboard-document-check" class="w-4 h-4 text-primary" />
                    {{ rule.name }}
                  </div>
                  <p v-if="rule.description" class="text-xs text-muted-foreground mt-1">
                    {{ rule.description }}
                  </p>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <span>{{ truncateCode(rule.code) }}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ rule.code }}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell v-if="ruleSets.length > 0" class="min-w-65">
                  <div @click.stop>
                    <MultiSelect :model-value="selectedRuleSetIdsByRule[rule.id] ?? []" :options="ruleSetOptions"
                      :loading="ruleSetsLoadingCombined" :error="ruleSetsErrorCombined" placeholder="Select rule sets"
                      search-placeholder="Search rule sets..."
                      @update:model-value="(value) => handleRuleSetSelection(rule.id, value)" />
                  </div>
                </TableCell>
                <TableCell>
                  <div class="text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <span>By {{ truncateCreatedBy(rule.createdBy) }}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {{ rule.createdBy }}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ formatDate(rule.createdAt) }}
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button variant="link" size="sm" class="h-8 w-8 p-0" @click.stop="copyRuleJson(rule)">
                        <Icon icon="heroicons:clipboard" class="w-4 h-4" />
                        <span class="sr-only">Copy JSON</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy JSON</TooltipContent>
                  </Tooltip>
                  <Button variant="link" size="sm" class="h-8 w-8 p-0" @click.stop="editRule(rule)">
                    <Icon icon="heroicons:pencil" class="w-4 h-4" />
                    <span class="sr-only">Edit</span>
                  </Button>
                  <Button variant="link" size="sm" class="h-8 w-8 p-0 text-destructive"
                    @click.stop="confirmDelete(rule)">
                    <Icon icon="heroicons:trash" class="w-4 h-4" />
                    <span class="sr-only">Delete</span>
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <!-- Create/Edit Rule Dialog -->
    <Dialog v-model:open="showCreateDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingRule ? 'Edit Rule' : 'Create New Rule' }}</DialogTitle>
          <DialogDescription>
            {{ editingRule ? 'Update the rule.' : 'Create a new rule.' }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div v-if="!editingRule" class="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-1">
            <Button size="sm" :variant="createMode === 'manual' ? 'solid' : 'ghost'" class="flex-1"
              @click="createMode = 'manual'">
              Manual
            </Button>
            <Button size="sm" :variant="createMode === 'json' ? 'solid' : 'ghost'" class="flex-1"
              @click="createMode = 'json'">
              JSON
            </Button>
            <Button size="sm" :variant="createMode === 'ai' ? 'solid' : 'ghost'" class="flex-1"
              @click="createMode = 'ai'">
              AI
            </Button>
          </div>

          <template v-if="createMode === 'json' && !editingRule">
            <div class="space-y-2">
              <Label for="rule-json">Paste JSON</Label>
              <Textarea id="rule-json" v-model="ruleJsonInput"
                placeholder='{"code":"...","name":"...","description":"..."} or [{...}, {...}]' rows="4" />
              <p class="text-xs text-muted-foreground">
                Accepts a single rule object or an array of rule objects (JSON5 supported).
              </p>
            </div>
          </template>

          <template v-else-if="createMode === 'ai' && !editingRule">
            <div class="space-y-2">
              <Label for="rule-ai-prompt">Describe the rule</Label>
              <Textarea id="rule-ai-prompt" v-model="aiPrompt" placeholder="Describe the policy you want to enforce..."
                rows="4" />
              <div class="text-xs text-muted-foreground space-y-1">
                <p>Examples:</p>
                <p>• “Require each document to include an effective date.”</p>
                <p>• “Flag claims that mention guarantees or promises of results.”</p>
                <p>• “Ensure all pricing references include currency.”</p>
              </div>
            </div>
            <div class="space-y-2">
              <Label>Reference existing rules (optional)</Label>
              <MultiSelect :model-value="aiReferenceRuleIds" :options="referenceRuleOptions"
                :disable-when-loading="false" placeholder="Select rules for context"
                search-placeholder="Search rules..."
                @update:model-value="(value) => (aiReferenceRuleIds = value as number[])">
                <template #option="{ option, selected }">
                  <div class="flex w-full items-center justify-between gap-2">
                    <div class="grid min-w-0 flex-1 grid-cols-[140px_minmax(0,1fr)] gap-2 text-left">
                      <span class="truncate font-mono text-xs text-muted-foreground">
                        {{ option.code || "—" }}
                      </span>
                      <span class="truncate">
                        {{ option.label }}
                      </span>
                    </div>
                    <Icon v-if="selected" icon="lucide:check" class="h-4 w-4" />
                  </div>
                </template>
              </MultiSelect>
              <p class="text-xs text-muted-foreground">
                Referenced rules will be passed to the AI as examples or constraints.
              </p>
            </div>
          </template>

          <template v-else>
            <div class="space-y-2">
              <Label for="rule-code">Code</Label>
              <Input id="rule-code" v-model="ruleForm.code" placeholder="rule_code" />
            </div>
            <div class="space-y-2">
              <Label for="rule-name">Name</Label>
              <Input id="rule-name" v-model="ruleForm.name" placeholder="Rule name" />
            </div>
            <div class="space-y-2">
              <Label for="rule-description">Description</Label>
              <Textarea id="rule-description" v-model="ruleForm.description" placeholder="Brief description..."
                rows="2" />
            </div>
          </template>
          <div v-if="!editingRule" class="flex items-center gap-2">
            <input id="check-duplicates" type="checkbox" v-model="checkDuplicatesEnabled"
              class="rounded border-input" />
            <Label for="check-duplicates" class="text-sm">
              Check for duplicate rules
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateDialog = false">
            Cancel
          </Button>
          <Button @click="handleSave" :disabled="!canSave || createSubmitting">
            <Icon v-if="createSubmitting" icon="heroicons:arrow-path" class="w-4 h-4 mr-2 animate-spin" />
            {{ createSubmitting ? "Creating..." : (editingRule ? 'Save Changes' : 'Create Rule') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showDuplicatesDialog">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Potential duplicate rules</DialogTitle>
          <DialogDescription>
            Review duplicates and choose which new rules to keep.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div v-for="entry in duplicateList" :key="entry.index" class="rounded-lg border border-border p-3 space-y-2">
            <div class="flex items-start gap-2">
              <input type="checkbox" :id="`dup-${entry.index}`" :checked="selectedRuleIndexes.includes(entry.index)"
                @change="toggleRuleSelection(entry.index)" class="mt-1 rounded border-input" />
              <label :for="`dup-${entry.index}`" class="flex-1">
                <div class="text-sm font-medium">
                  {{ entry.rule.name }} ({{ entry.rule.code }})
                </div>
                <div v-if="entry.rule.description" class="text-xs text-muted-foreground mt-1">
                  {{ entry.rule.description }}
                </div>
              </label>
            </div>
            <div v-if="entry.matches.length > 0" class="space-y-2 text-xs text-muted-foreground">
              <div class="font-medium text-foreground">Matches:</div>
              <div v-for="match in entry.matches" :key="match.id" class="rounded-md bg-muted/50 p-2">
                <div class="text-sm text-foreground">
                  {{ match.name }} ({{ match.code }})
                </div>
                <div v-if="match.description" class="mt-1">
                  {{ match.description }}
                </div>
                <div class="mt-1">
                  Similarity: {{ match.similarity.toFixed(2) }}
                  <span v-if="match.reason"> — {{ match.reason }}</span>
                </div>
              </div>
            </div>
            <div v-else class="text-xs text-muted-foreground">
              No duplicates detected.
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="cancelDuplicates">
            Cancel
          </Button>
          <Button @click="confirmDuplicates">
            Create selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showJsonConfirmDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm import</DialogTitle>
          <DialogDescription>
            You are about to create {{ jsonConfirmCount }} rules from pasted JSON. Proceed?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="cancelJsonRules">
            Cancel
          </Button>
          <Button @click="confirmJsonRules">
            Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Create Rule Set Dialog -->
    <Dialog v-model:open="showCreateRuleSetDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Rule Set</DialogTitle>
          <DialogDescription>Rule sets are global and can be linked to rules.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="rule-set-name">Name</Label>
            <Input id="rule-set-name" v-model="ruleSetForm.name" placeholder="Rule set name" />
          </div>
          <div class="space-y-2">
            <Label for="rule-set-description">Description</Label>
            <Textarea id="rule-set-description" v-model="ruleSetForm.description" placeholder="Brief description..."
              rows="2" />
          </div>
          <div class="space-y-2">
            <Label>Include rules (optional)</Label>
            <MultiSelect :model-value="ruleSetRuleIds" :options="referenceRuleOptions" :disable-when-loading="false"
              placeholder="Select rules to include" search-placeholder="Search rules..."
              @update:model-value="(value) => (ruleSetRuleIds = value as number[])">
              <template #option="{ option, selected }">
                <div class="flex w-full items-center justify-between gap-2">
                  <div class="grid min-w-0 flex-1 grid-cols-[140px_minmax(0,1fr)] gap-2 text-left">
                    <span class="truncate font-mono text-xs text-muted-foreground">
                      {{ option.code || "—" }}
                    </span>
                    <span class="truncate">
                      {{ option.label }}
                    </span>
                  </div>
                  <Icon v-if="selected" icon="lucide:check" class="h-4 w-4" />
                </div>
              </template>
            </MultiSelect>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateRuleSetDialog = false">
            Cancel
          </Button>
          <Button @click="handleCreateRuleSet" :disabled="!canCreateRuleSet">
            Create Rule set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Rule</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{{ ruleToDelete?.name }}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">
            Cancel
          </Button>
          <Button variant="solid" color="error" @click="handleDelete">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showExportDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Rules</DialogTitle>
          <DialogDescription>
            Choose file format and columns to export from current filtered rules.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-2">
            <Label>Format</Label>
            <div class="flex items-center gap-2">
              <Button
                size="sm"
                :variant="exportFormat === 'xlsx' ? 'solid' : 'outline'"
                @click="exportFormat = 'xlsx'"
              >
                XLSX
              </Button>
              <Button
                size="sm"
                :variant="exportFormat === 'csv' ? 'solid' : 'outline'"
                @click="exportFormat = 'csv'"
              >
                CSV
              </Button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>Columns</Label>
            <div class="grid grid-cols-2 gap-2">
              <label
                v-for="option in exportColumnOptions"
                :key="option.key"
                class="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  :checked="exportColumns.includes(option.key)"
                  @change="toggleExportColumn(option.key)"
                  class="rounded border-input"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
            <p v-if="!canExportRules" class="text-xs text-muted-foreground">
              Select at least one column to enable export.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showExportDialog = false">Cancel</Button>
          <Button :disabled="!canExportRules" @click="exportRules">Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from "vue"
import { Icon } from "@iconify/vue"
import { storeToRefs } from "pinia"
import { parseRulesFromJsonInput } from "@wenyan/shared"
import type { Rule } from "@wenyan/shared"
import * as XLSX from "xlsx"
import { useRules } from "@/composables/useRules"
import { useRuleSets } from "@/composables/useRuleSets"
import { useRuleSetsRelRulesStore } from "@/stores/ruleSetsRelRules"
import { useToast } from "@/composables/useToast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const { data: rules, loading, error, fetchAll, create, createWithAi, checkDuplicates, patch, remove } = useRules()
const { data: ruleSets, loading: ruleSetsLoading, error: ruleSetsError, fetchAll: fetchRuleSets, create: createRuleSet } = useRuleSets()
const ruleSetRules = useRuleSetsRelRulesStore()
const { ruleSetRulesMap, loading: ruleSetRulesLoading, error: ruleSetRulesError } = storeToRefs(ruleSetRules)
const { success: showSuccess, error: showError } = useToast()

const showCreateDialog = ref(false)
const createSubmitting = ref(false)
const createMode = ref<"manual" | "json" | "ai">("manual")
const ruleJsonInput = ref("")
const aiPrompt = ref("")
const aiReferenceRuleIds = ref<number[]>([])
const checkDuplicatesEnabled = ref(true)
const showDuplicatesDialog = ref(false)
const proposedRules = ref<Array<{ code: string; name: string; description?: string }>>([])
const duplicateMatches = ref<Record<number, Array<{ id: number; code: string; name: string; description: string | null; similarity: number; reason?: string }>>>({})
const selectedRuleIndexes = ref<number[]>([])
const showJsonConfirmDialog = ref(false)
const jsonConfirmCount = ref(0)
const pendingJsonRules = ref<Array<{ code: string; name: string; description?: string }>>([])
const showCreateRuleSetDialog = ref(false)
const showDeleteDialog = ref(false)
const showExportDialog = ref(false)
const editingRule = ref<Rule | null>(null)
const ruleToDelete = ref<Rule | null>(null)
const searchQuery = ref("")
const exportFormat = ref<"csv" | "xlsx">("xlsx")

type ExportColumnKey = "name" | "code" | "description" | "ruleSets" | "createdBy" | "createdAt"
const exportColumns = ref<ExportColumnKey[]>(["name", "code", "description", "createdBy", "createdAt"])
const exportColumnOptions: Array<{ key: ExportColumnKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "code", label: "Code" },
  { key: "description", label: "Description" },
  { key: "ruleSets", label: "Rule sets" },
  { key: "createdBy", label: "Created by" },
  { key: "createdAt", label: "Created at" },
]
const canExportRules = computed(() => exportColumns.value.length > 0)

const ruleForm = reactive({
  code: "",
  name: "",
  description: "",
})

const ruleSetForm = reactive({
  name: "",
  description: "",
})

const ruleSetRuleIds = ref<number[]>([])

const selectedRuleSetIdsByRule = ref<Record<number, Array<string | number>>>({})
const syncingRuleIds = ref<number[]>([])

const ruleSetOptions = computed(() =>
  ruleSets.value.map((ruleSet) => ({ value: ruleSet.id, label: ruleSet.name })),
)

const ruleSetNameById = computed(() =>
  new Map(ruleSets.value.map((ruleSet) => [ruleSet.id, ruleSet.name])),
)

const ruleSetsLoadingCombined = computed(
  () => ruleSetsLoading.value || ruleSetRulesLoading.value,
)
const ruleSetsErrorCombined = computed(
  () => ruleSetsError.value || ruleSetRulesError.value || "",
)

const canSave = computed(() => {
  if (editingRule.value) {
    return ruleForm.code.trim().length > 0 && ruleForm.name.trim().length > 0
  }
  if (createMode.value === "json") {
    return ruleJsonInput.value.trim().length > 0
  }
  if (createMode.value === "ai") {
    return aiPrompt.value.trim().length > 0
  }
  return ruleForm.code.trim().length > 0 && ruleForm.name.trim().length > 0
})

const canCreateRuleSet = computed(() => ruleSetForm.name.trim().length > 0)

const showNewRuleSetButton = computed(() => rules.value.length > 1)
const showRuleSetsLink = computed(() => ruleSets.value.length > 0)

const showSearch = computed(() => rules.value.length > 5)
const filteredRules = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const sorted = [...rules.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  if (!query) return sorted
  return sorted.filter((rule) => {
    const name = rule.name?.toLowerCase() ?? ""
    const description = rule.description?.toLowerCase() ?? ""
    const code = rule.code?.toLowerCase() ?? ""
    const createdBy = rule.createdBy?.toLowerCase() ?? ""
    return (
      name.includes(query)
      || description.includes(query)
      || code.includes(query)
      || createdBy.includes(query)
    )
  })
})

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString()
}

function truncateCreatedBy(value: string) {
  if (value.length <= 20) return value
  return `${value.slice(0, 20)}…`
}

function truncateCode(value: string) {
  if (value.length <= 20) return value
  return `${value.slice(0, 20)}…`
}

function resetForm() {
  ruleForm.code = ""
  ruleForm.name = ""
  ruleForm.description = ""
  editingRule.value = null
  ruleJsonInput.value = ""
  aiPrompt.value = ""
  aiReferenceRuleIds.value = []
  createMode.value = "manual"
  checkDuplicatesEnabled.value = true
}

function resetRuleSetForm() {
  ruleSetForm.name = ""
  ruleSetForm.description = ""
  ruleSetRuleIds.value = []
}

function goToRuleSets() {
  window.location.href = "/rule-sets"
}

function getRuleSetIdsForRule(ruleId: number): number[] {
  return Object.entries(ruleSetRulesMap.value)
    .filter(([, ruleIds]) => ruleIds.includes(ruleId))
    .map(([ruleSetId]) => Number(ruleSetId))
}

function getRuleSetNamesForRule(ruleId: number): string {
  const names = getRuleSetIdsForRule(ruleId)
    .map((id) => ruleSetNameById.value.get(id))
    .filter((name): name is string => Boolean(name))
  return names.join(", ")
}

function syncRuleSetSelection(ruleId: number, next: number[]) {
  if (!syncingRuleIds.value.includes(ruleId)) {
    syncingRuleIds.value = [...syncingRuleIds.value, ruleId]
  }
  selectedRuleSetIdsByRule.value = {
    ...selectedRuleSetIdsByRule.value,
    [ruleId]: next,
  }
  queueMicrotask(() => {
    syncingRuleIds.value = syncingRuleIds.value.filter((id) => id !== ruleId)
  })
}

async function handleRuleSetSelection(ruleId: number, value: Array<string | number>) {
  if (syncingRuleIds.value.includes(ruleId)) return
  const next = value.map((id) => Number(id)).filter((id) => Number.isFinite(id)) as number[]
  const current = getRuleSetIdsForRule(ruleId)
  const toAdd = next.filter((id) => !current.includes(id))
  const toRemove = current.filter((id) => !next.includes(id))

  try {
    await Promise.all([
      ...toAdd.map((ruleSetId) => ruleSetRules.linkRule(ruleSetId, ruleId)),
      ...toRemove.map((ruleSetId) => ruleSetRules.unlinkRule(ruleSetId, ruleId)),
    ])
    syncRuleSetSelection(ruleId, next)
  } catch (e) {
    showError("Failed to update rule sets", e instanceof Error ? e.message : "Unknown error")
    syncRuleSetSelection(ruleId, current)
  }
}

function editRule(rule: Rule) {
  editingRule.value = rule
  ruleForm.code = rule.code
  ruleForm.name = rule.name
  ruleForm.description = rule.description || ""
  createMode.value = "manual"
  ruleJsonInput.value = ""
  aiPrompt.value = ""
  aiReferenceRuleIds.value = []
  showCreateDialog.value = true
}

function openCreateRule() {
  resetForm()
  showCreateDialog.value = true
}

const referenceRuleOptions = computed(() =>
  rules.value.map((rule) => ({
    value: rule.id,
    label: rule.name || rule.code,
    code: rule.code,
    searchText: `${rule.code} ${rule.name}`,
  })),
)

const duplicateList = computed(() =>
  proposedRules.value.map((rule, index) => ({
    index,
    rule,
    matches: duplicateMatches.value[index] || [],
  })),
)

async function copyRuleJson(rule: Rule) {
  const payload = {
    code: rule.code,
    name: rule.name,
    description: rule.description || "",
  }
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    showSuccess("Copied", "Rule JSON copied to clipboard.")
  } catch (e) {
    showError("Copy failed", e instanceof Error ? e.message : "Unable to copy JSON")
  }
}

function confirmDelete(rule: Rule) {
  ruleToDelete.value = rule
  showDeleteDialog.value = true
}

async function runDuplicateCheck(candidateRules: Array<{ code: string; name: string; description?: string }>) {
  proposedRules.value = candidateRules
  const duplicates = await checkDuplicates({ proposed: candidateRules })
  const matchMap: Record<number, Array<{ id: number; code: string; name: string; description: string | null; similarity: number; reason?: string }>> = {}
  for (const entry of duplicates) {
    matchMap[entry.proposedIndex] = entry.matches || []
  }
  duplicateMatches.value = matchMap
  selectedRuleIndexes.value = candidateRules.map((_, index) => index)
  if (duplicates.length === 0) {
    proposedRules.value = []
    duplicateMatches.value = {}
    selectedRuleIndexes.value = []
    return candidateRules
  }
  showDuplicatesDialog.value = true
  return []
}

function toggleRuleSelection(index: number) {
  if (selectedRuleIndexes.value.includes(index)) {
    selectedRuleIndexes.value = selectedRuleIndexes.value.filter((id) => id !== index)
  } else {
    selectedRuleIndexes.value = [...selectedRuleIndexes.value, index]
  }
}

function cancelDuplicates() {
  showDuplicatesDialog.value = false
  proposedRules.value = []
  duplicateMatches.value = {}
  selectedRuleIndexes.value = []
}

async function confirmDuplicates() {
  const selected = proposedRules.value.filter((_, index) => selectedRuleIndexes.value.includes(index))
  createSubmitting.value = true
  try {
    await createRules(selected)
    showDuplicatesDialog.value = false
    proposedRules.value = []
    duplicateMatches.value = {}
    selectedRuleIndexes.value = []
  } finally {
    createSubmitting.value = false
  }
}

async function createRules(items: Array<{ code: string; name: string; description?: string }>) {
  if (items.length === 0) {
    showError("No rules selected", "Select at least one rule to create.")
    return
  }
  try {
    for (const item of items) {
      await create({
        code: item.code,
        name: item.name,
        description: item.description?.trim() || undefined,
      })
    }
    showSuccess(
      "Rules created",
      items.length === 1 ? "Rule has been created." : `${items.length} rules have been created.`,
    )
    showCreateDialog.value = false
    resetForm()
  } catch (e) {
    throw e
  }
}

async function handleSave() {
  if (createSubmitting.value) return
  createSubmitting.value = true
  try {
    if (editingRule.value) {
      await patch(editingRule.value.id, {
        code: ruleForm.code.trim(),
        name: ruleForm.name.trim(),
        description: ruleForm.description.trim() || undefined,
      })
      showSuccess("Rule updated", `"${ruleForm.name}" has been updated.`)
    } else if (createMode.value === "json") {
      const raw = ruleJsonInput.value.trim()
      if (!raw) {
        showError("Invalid JSON", "Paste JSON to create rules.")
        return
      }
      const parsedRules = parseRulesFromJsonInput(raw)
      if (!parsedRules.success) {
        showError("Invalid JSON", parsedRules.message)
        return
      }
      const candidate = parsedRules.data
      if (candidate.length > 1) {
        pendingJsonRules.value = candidate
        jsonConfirmCount.value = candidate.length
        showJsonConfirmDialog.value = true
        createSubmitting.value = false
        return
      }
      if (checkDuplicatesEnabled.value) {
        const result = await runDuplicateCheck(candidate)
        if (result.length === 0) {
          createSubmitting.value = false
          return
        }
        await createRules(result)
        return
      }
      await createRules(candidate)
    } else if (createMode.value === "ai") {
      const generated = await createWithAi({
        prompt: aiPrompt.value.trim(),
        referenceRuleIds: aiReferenceRuleIds.value,
      })
      if (generated.length === 0) {
        showError("No rules generated", "AI did not return any rules.")
        return
      }
      const normalizedGenerated = generated.map((rule) => ({
        code: rule.code,
        name: rule.name,
        description: rule.description ?? undefined,
      }))
      if (checkDuplicatesEnabled.value) {
        const result = await runDuplicateCheck(normalizedGenerated)
        if (result.length === 0) {
          createSubmitting.value = false
          return
        }
        await createRules(result)
        return
      }
      await createRules(normalizedGenerated)
    } else {
      const candidate = [{
        code: ruleForm.code.trim(),
        name: ruleForm.name.trim(),
        description: ruleForm.description.trim(),
      }]
      if (checkDuplicatesEnabled.value) {
        const result = await runDuplicateCheck(candidate)
        if (result.length === 0) {
          createSubmitting.value = false
          return
        }
        await createRules(result)
        return
      }
      await createRules(candidate)
    }
  } catch (e) {
    showError("Failed to save rule", e instanceof Error ? e.message : "Unknown error")
  } finally {
    createSubmitting.value = false
  }
}

async function confirmJsonRules() {
  const candidate = pendingJsonRules.value
  showJsonConfirmDialog.value = false
  pendingJsonRules.value = []
  if (candidate.length === 0) return
  createSubmitting.value = true
  try {
    if (checkDuplicatesEnabled.value) {
      const result = await runDuplicateCheck(candidate)
      if (result.length === 0) return
      await createRules(result)
      return
    }
    await createRules(candidate)
  } finally {
    createSubmitting.value = false
  }
}

function cancelJsonRules() {
  showJsonConfirmDialog.value = false
  pendingJsonRules.value = []
}

async function handleCreateRuleSet() {
  try {
    const created = await createRuleSet({
      name: ruleSetForm.name.trim(),
      description: ruleSetForm.description.trim() || undefined,
    })
    if (ruleSetRuleIds.value.length > 0) {
      await Promise.all(
        ruleSetRuleIds.value.map((ruleId) => ruleSetRules.linkRule(created.id, ruleId)),
      )
    }
    showSuccess("Rule set created", `"${ruleSetForm.name}" has been created.`)
    showCreateRuleSetDialog.value = false
    resetRuleSetForm()
    await fetchRuleSets()
  } catch (e) {
    showError("Failed to create rule set", e instanceof Error ? e.message : "Unknown error")
  }
}

async function handleDelete() {
  if (!ruleToDelete.value) return

  try {
    await remove(ruleToDelete.value.id)
    showSuccess("Rule deleted", `"${ruleToDelete.value.name}" has been deleted.`)
    showDeleteDialog.value = false
    ruleToDelete.value = null
  } catch (e) {
    showError("Failed to delete rule", e instanceof Error ? e.message : "Unknown error")
  }
}

function toggleExportColumn(column: ExportColumnKey) {
  if (exportColumns.value.includes(column)) {
    exportColumns.value = exportColumns.value.filter((item) => item !== column)
    return
  }
  exportColumns.value = [...exportColumns.value, column]
}

function buildExportRows() {
  const columns = exportColumnOptions.filter((option) => exportColumns.value.includes(option.key))
  const header = columns.map((column) => column.label)
  const rows = filteredRules.value.map((rule) =>
    columns.map((column) => {
      if (column.key === "name") return rule.name
      if (column.key === "code") return rule.code
      if (column.key === "description") return rule.description || ""
      if (column.key === "ruleSets") return getRuleSetNamesForRule(rule.id)
      if (column.key === "createdBy") return rule.createdBy || ""
      if (column.key === "createdAt") return formatDate(rule.createdAt)
      return ""
    }),
  )
  return [header, ...rows]
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportRules() {
  if (!canExportRules.value) {
    showError("No columns selected", "Choose at least one column to export.")
    return
  }

  const rows = buildExportRows()
  const stamp = new Date().toISOString().slice(0, 10)

  if (exportFormat.value === "csv") {
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const withBom = `\uFEFF${csv}`
    downloadBlob(`rules-${stamp}.csv`, new Blob([withBom], { type: "text/csv;charset=utf-8" }))
    showExportDialog.value = false
    return
  }

  try {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rules")
    const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    downloadBlob(
      `rules-${stamp}.xlsx`,
      new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    )
    showExportDialog.value = false
  } catch (error) {
    showError("Export failed", error instanceof Error ? error.message : "Unable to create XLSX file.")
  }
}

onMounted(() => {
  fetchAll()
  fetchRuleSets()
})

watch(
  () => ruleSetRulesMap.value,
  () => {
    for (const rule of rules.value) {
      if (!syncingRuleIds.value.includes(rule.id)) {
        syncRuleSetSelection(rule.id, getRuleSetIdsForRule(rule.id))
      }
    }
  },
  { deep: true },
)

watch(
  () => ruleSets.value,
  async (value) => {
    if (value.length === 0) return
    await Promise.all(value.map((set) => ruleSetRules.fetchByRuleSetId(set.id)))
  },
  { immediate: true },
)
</script>
