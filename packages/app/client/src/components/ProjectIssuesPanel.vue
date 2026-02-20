<template>
  <div class="space-y-4 p-2">
    <IssuesFilterBar
      :issues="issues"
      :get-rule-name="getRuleName"
      filter-layout="both"
      :search-query="issueSearchQuery"
      :selected-rule-ids="selectedRuleIds"
      :selected-severities="selectedSeverities"
      :show-rule-badges="showRuleBadges"
      :show-severity-badges="true"
      :filtered-count-label="showFilteredCount ? `${filteredIssues.length} / ${issues.length}` : ''"
      @update:search-query="(value) => (issueSearchQuery = value)"
      @update:selected-rule-ids="(value) => (selectedRuleIds = value)"
      @update:selected-severities="(value) => (selectedSeverities = value)"
      @clear="clearAllFilters"
    />
    <div class="flex items-center justify-between">
      <div class="flex items-baseline gap-2">
        <h3 class="text-lg font-medium">Issues</h3>
      </div>
      <div class="flex flex-col items-end gap-2 text-right">
        <div class="flex items-center gap-2">
          <div ref="analyzeMenuRef" class="relative flex">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="sm" variant="solid" class="rounded-r-none"
                  :disabled="analyzingIssues || !canAnalyzeIssues" @click="emit('analyze', analyzeMode)">
                  <Icon v-if="analyzingIssues" icon="heroicons:arrow-path" class="w-4 h-4 mr-2 animate-spin" />
                  <Icon v-else icon="heroicons:cpu-chip" class="w-4 h-4 mr-2" />
                  {{ analyzingIssues ? "Analyzing..." : analyzeLabel }}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {{ analyzeIssuesTooltip }}
              </TooltipContent>
            </Tooltip>
            <Button v-if="hasIssues" size="sm" variant="solid" class="rounded-l-none px-2" :disabled="analyzingIssues"
              @click="toggleAnalyzeMenu">
              <Icon icon="heroicons:chevron-down" class="w-4 h-4" />
            </Button>
            <Transition enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 scale-95 -translate-y-2" enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 scale-100 translate-y-0" leave-to-class="opacity-0 scale-95 -translate-y-2">
              <div v-if="showAnalyzeMenu && hasIssues"
                class="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                <button type="button"
                  class="grid w-full grid-cols-[16px_1fr] items-start gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                  @click="selectAnalyzeMode('replace_all')">
                  <Icon v-if="analyzeMode === 'replace_all'" icon="heroicons:check" class="mt-0.5 h-4 w-4" />
                  <span v-else class="h-4 w-4" />
                  <span>
                    Drop all, then analyze
                  </span>
                </button>
                <button type="button"
                  class="grid w-full grid-cols-[16px_1fr] items-start gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                  @click="selectAnalyzeMode('replace_ai')">
                  <Icon v-if="analyzeMode === 'replace_ai'" icon="heroicons:check" class="mt-0.5 h-4 w-4" />
                  <span v-else class="h-4 w-4" />
                  <span>
                    Drop all but manual, then analyze
                  </span>
                </button>
                <button type="button"
                  class="grid w-full grid-cols-[16px_1fr] items-start gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                  @click="selectAnalyzeMode('incremental')">
                  <Icon v-if="analyzeMode === 'incremental'" icon="heroicons:check" class="mt-0.5 h-4 w-4" />
                  <span v-else class="h-4 w-4" />
                  <span>
                    Incremental only (new issues)
                  </span>
                </button>
              </div>
            </Transition>
          </div>
          <Tooltip>
            <TooltipTrigger as-child>
              <div>
                <Select :model-value="effort" @update:model-value="(value) => emit('update:effort', value as any)">
                  <SelectTrigger class="h-9 w-35">
                    <SelectValue placeholder="Effort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="option in effortOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Controls how thorough the AI should be. Higher effort returns more issues and takes longer.
            </TooltipContent>
          </Tooltip>
        </div>
        <p class="text-xs text-muted-foreground">
          Runs AI over all project documents using effective rules.
        </p>
      </div>
    </div>
    <div v-if="issuesLoading" class="text-center py-8 border rounded-lg">
      <Icon icon="heroicons:arrow-path" class="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
      <p class="mt-4 text-muted-foreground">Loading issues...</p>
    </div>

    <div v-else-if="issues.length === 0" class="text-center py-8 border rounded-lg">
      <Icon icon="heroicons:exclamation-triangle" class="w-12 h-12 mx-auto text-muted-foreground" />
      <p class="mt-4 text-muted-foreground">No issues yet.</p>
      <p class="text-sm text-muted-foreground">Analyze documents or add issues manually.</p>
    </div>

    <div v-else-if="filteredIssues.length === 0" class="text-center py-8 border rounded-lg">
      <Icon icon="heroicons:magnifying-glass" class="w-12 h-12 mx-auto text-muted-foreground" />
      <p class="mt-4 text-muted-foreground">No issues match your filters.</p>
      <p class="text-sm text-muted-foreground">Clear filters to show all issues.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <IssueCard v-for="issue in sortedFilteredIssues" :key="issue.id" :issue="issue"
        :project-documents-count="documents.length" :project-rules-count="projectRulesCount"
        :get-rule-name="getRuleName" :get-status-variant="getStatusVariant" :get-status-color="getStatusColor"
        :get-priority-variant="getPriorityVariant" :get-priority-color="getPriorityColor"
        @toggle-non-issue="emit('toggle-non-issue', $event)" @delete-issue="openDeleteIssueDialog"
        @open-document="(doc, issue) => emit('open-document', doc, issue)" />
    </div>
  </div>

  <Dialog v-model:open="showCreateIssueDialog">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Create New Issue</DialogTitle>
        <DialogDescription>
          Create an issue to track a problem or task in this project.
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="issue-title">Title</Label>
          <Input id="issue-title" v-model="newIssue.title" placeholder="Brief description of the issue" />
        </div>
        <div class="space-y-2">
          <Label for="issue-description">Description</Label>
          <Textarea id="issue-description" v-model="newIssue.description" placeholder="Detailed description..."
            rows="3" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="issue-priority">Priority</Label>
            <Select v-model="newIssue.priority">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="issue-status">Status</Label>
            <Select v-model="newIssue.status">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div class="space-y-2">
          <Label>Linked Documents</Label>
          <div class="border rounded-lg p-3 space-y-2">
            <div v-for="doc in documents" :key="doc.id" class="flex items-center gap-2">
              <input type="checkbox" :id="`doc-${doc.id}`" :value="doc.id" v-model="newIssue.documentIds"
                class="rounded border-input" />
              <label :for="`doc-${doc.id}`" class="text-sm cursor-pointer">
                {{ doc.filename }}
              </label>
            </div>
            <p v-if="documents.length === 0" class="text-sm text-muted-foreground">
              No documents available. Upload documents first.
            </p>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="showCreateIssueDialog = false">
          Cancel
        </Button>
        <Button @click="handleCreateIssue" :disabled="!newIssue.title.trim()">
          Create Issue
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="showDeleteIssueDialog">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Delete issue?</DialogTitle>
        <DialogDescription>
          This will permanently delete "{{ issueToDelete?.title || "this issue" }}".
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" :disabled="deleteIssueSubmitting" @click="showDeleteIssueDialog = false">
          Cancel
        </Button>
        <Button variant="solid" color="error" :disabled="deleteIssueSubmitting" @click="confirmDeleteIssue">
          {{ deleteIssueSubmitting ? "Deleting..." : "Delete" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import { Button } from "@/components/ui/button"
import IssueCard from "@/components/IssueCard.vue"
import IssuesFilterBar from "@/components/IssuesFilterBar.vue"
import type { BadgeColor, BadgeVariant } from "@/utils/issues-utils"
import { compareIssuesBySeverityTitle } from "@/utils/issues-utils"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const props = defineProps<{
  issues: any[]
  documents: any[]
  issuesLoading: boolean
  analyzingIssues: boolean
  canAnalyzeIssues: boolean
  analyzeIssuesTooltip: string
  analyzeMode: "replace_all" | "replace_ai" | "incremental"
  effort: "sample" | "low" | "medium" | "high" | "extra_high"
  projectRulesCount: number
  getRuleName: (ruleId: number) => string
  getStatusVariant: (status: string) => BadgeVariant
  getStatusColor: (status: string) => BadgeColor
  getPriorityVariant: (priority: string) => BadgeVariant
  getPriorityColor: (priority: string) => BadgeColor
}>()

const emit = defineEmits<{
  analyze: ["replace_all" | "replace_ai" | "incremental"]
  "update:analyze-mode": ["replace_all" | "replace_ai" | "incremental"]
  "update:effort": ["sample" | "low" | "medium" | "high" | "extra_high"]
  "toggle-non-issue": [any]
  "open-document": [any, any]
  "create-issue": [any]
  "delete-issue": [any]
}>()

const selectedRuleIds = ref<number[]>([])
const issueSearchQuery = ref("")
const debouncedSearchQuery = ref("")
let searchDebounceTimer: number | null = null
const selectedSeverities = ref<Array<"low" | "medium" | "high" | "critical">>([])

const selectedRuleIdSet = computed(() => new Set(selectedRuleIds.value))
const selectedSeveritySet = computed(() => new Set(selectedSeverities.value))
const showRuleBadges = computed(() => props.projectRulesCount > 1)
const showFilteredCount = computed(
  () => filteredIssues.value.length !== props.issues.length,
)

watch(
  issueSearchQuery,
  (value) => {
    if (searchDebounceTimer != null) {
      window.clearTimeout(searchDebounceTimer)
    }
    searchDebounceTimer = window.setTimeout(() => {
      debouncedSearchQuery.value = value
    }, 150)
  },
  { immediate: true },
)

onUnmounted(() => {
  if (searchDebounceTimer != null) {
    window.clearTimeout(searchDebounceTimer)
  }
})

const filteredIssues = computed(() => {
  const search = debouncedSearchQuery.value.trim().toLowerCase()
  return props.issues.filter((issue) => {
    const ruleIds = Array.isArray(issue.ruleIds) ? issue.ruleIds : []
    const matchesRules = !selectedRuleIds.value.length
      ? true
      : ruleIds.some((ruleId: number) => selectedRuleIdSet.value.has(ruleId))
    const matchesSeverity = !selectedSeverities.value.length
      ? true
      : selectedSeveritySet.value.has(issue?.priority)
    const matchesSearch = !search
      ? true
      : [
          issue?.title,
          issue?.description,
          ...ruleIds.map((ruleId: number) => props.getRuleName(ruleId)),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
    return matchesRules && matchesSeverity && matchesSearch
  })
})

const sortedFilteredIssues = computed(() => {
  return [...filteredIssues.value].sort(compareIssuesBySeverityTitle)
})

function clearAllFilters() {
  selectedRuleIds.value = []
  selectedSeverities.value = []
}

const hasIssues = computed(() => props.issues.length > 0)

const analyzeLabel = computed(() => {
  if (!hasIssues.value) return "Analyze"
  return `Analyze (${activeModeLabel.value})`
})

const effortOptions = [
  { value: "sample", label: "Sample" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "extra_high", label: "Extra-high" },
]

const activeModeLabel = computed(() => {
  if (!hasIssues.value) return "incremental"
  if (props.analyzeMode === "replace_all") return "drop all"
  if (props.analyzeMode === "replace_ai") return "drop AI"
  return "incremental"
})

const showCreateIssueDialog = ref(false)
const showDeleteIssueDialog = ref(false)
const deleteIssueSubmitting = ref(false)
const issueToDelete = ref<{ id: number; title?: string } | null>(null)
const showAnalyzeMenu = ref(false)
const analyzeMenuRef = ref<HTMLElement | null>(null)
let removeClickListener: (() => void) | null = null
const newIssue = ref({
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  documentIds: [] as number[],
})

async function handleCreateIssue() {
  emit("create-issue", {
    title: newIssue.value.title.trim(),
    description: newIssue.value.description.trim() || undefined,
    priority: newIssue.value.priority,
    status: newIssue.value.status,
    documentIds: newIssue.value.documentIds,
  })
  newIssue.value = {
    title: "",
    description: "",
    priority: "medium",
    status: "open",
    documentIds: [],
  }
  showCreateIssueDialog.value = false
}

function openDeleteIssueDialog(issue: { id: number; title?: string }) {
  issueToDelete.value = issue
  showDeleteIssueDialog.value = true
}

async function confirmDeleteIssue() {
  if (!issueToDelete.value) return
  try {
    deleteIssueSubmitting.value = true
    emit("delete-issue", issueToDelete.value)
    showDeleteIssueDialog.value = false
    issueToDelete.value = null
  } finally {
    deleteIssueSubmitting.value = false
  }
}

function toggleAnalyzeMenu() {
  showAnalyzeMenu.value = !showAnalyzeMenu.value
}

function selectAnalyzeMode(mode: "replace_all" | "replace_ai" | "incremental") {
  emit("update:analyze-mode", mode)
  showAnalyzeMenu.value = false
}

onMounted(() => {
  if (!import.meta.client) return
  const handler = (event: MouseEvent) => {
    if (!showAnalyzeMenu.value) return
    const target = event.target as Node
    if (analyzeMenuRef.value && !analyzeMenuRef.value.contains(target)) {
      showAnalyzeMenu.value = false
    }
  }
  document.addEventListener("click", handler)
  removeClickListener = () => document.removeEventListener("click", handler)
})

onUnmounted(() => {
  removeClickListener?.()
  removeClickListener = null
})
</script>
