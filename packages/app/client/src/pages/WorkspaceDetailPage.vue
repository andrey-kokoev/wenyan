<template>
  <div class="container mx-auto py-8 px-4">
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="errorMessage" class="text-center py-12">
      <Icon icon="heroicons:exclamation-triangle" class="w-12 h-12 mx-auto text-destructive" />
      <p class="mt-4 text-destructive">{{ errorMessage }}</p>
      <Button variant="outline" class="mt-4" @click="fetchWorkspace">
        Retry
      </Button>
    </div>

    <div v-else-if="!workspace" class="text-center py-12">
      <Icon icon="heroicons:briefcase" class="w-12 h-12 mx-auto text-muted-foreground" />
      <p class="mt-4 text-muted-foreground">Workspace not found.</p>
      <Button class="mt-4" @click="$router.push('/workspaces')">
        Back to Workspaces
      </Button>
    </div>

    <div v-else class="space-y-6">
      <Button variant="ghost" @click="$router.push('/workspaces')">
        <Icon icon="heroicons:arrow-left" class="w-4 h-4 mr-2" />
        Back to Workspaces
      </Button>

      <WorkspaceCard>
        <div class="space-y-4">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium">Rules available to Projects in this Workspace</h3>
              <span v-if="rulesLoadingCombined" class="text-xs text-muted-foreground">Loading…</span>
            </div>
            <template v-if="showRuleSelector">
              <MultiSelect
                v-model="selectedRuleIds"
                :options="ruleOptions"
                :loading="rulesLoadingCombined"
                :disable-when-loading="false"
                :error="rulesErrorCombined"
                placeholder="Select rules for this workspace"
                search-placeholder="Search rules..."
                class="w-full"
              >
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
              <p v-if="rulesErrorCombined" class="text-xs text-destructive">{{ rulesErrorCombined }}</p>
            </template>
          </div>

          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium">Projects</h3>
            <Button variant="outline" size="sm" @click="goToProjects">
              View All Projects
            </Button>
          </div>

          <div v-if="projectsLoading" class="text-center py-6 border rounded-lg">
            <Icon icon="heroicons:arrow-path" class="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
            <p class="mt-3 text-muted-foreground">Loading projects...</p>
          </div>

          <div v-else-if="workspaceProjects.length === 0" class="text-center py-6 border rounded-lg">
            <Icon icon="heroicons:folder-open" class="w-10 h-10 mx-auto text-muted-foreground" />
            <p class="mt-3 text-muted-foreground">No projects in this workspace.</p>
            <p class="text-sm text-muted-foreground">Create one from the Projects page.</p>
          </div>

          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="project in workspaceProjects"
                :key="project.id"
                class="cursor-pointer hover:bg-muted/50"
                @click="goToProject(project.id)"
              >
                <TableCell class="font-medium">
                  <div class="flex items-center gap-2">
                    <Icon icon="heroicons:folder" class="w-4 h-4 text-primary" />
                    {{ project.name }}
                  </div>
                </TableCell>
                <TableCell class="max-w-xs truncate">
                  {{ project.description || "No description" }}
                </TableCell>
                <TableCell>{{ formatDate(project.createdAt) }}</TableCell>
                <TableCell class="text-right">
                  <Button variant="ghost" size="sm" @click.stop="goToProject(project.id)">
                    <Icon icon="heroicons:eye" class="w-4 h-4 mr-1" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </WorkspaceCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { Icon } from "@iconify/vue"
import { useWorkspaces } from "@/composables/useWorkspaces"
import { useProjects } from "@/composables/useProjects"
import { useRules } from "@/composables/useRules"
import { useWorkspacesRelRules } from "@/composables/useWorkspacesRelRules"
import { useWorkspaceContext } from "@/composables/useWorkspaceContext"
import { useToast } from "@/composables/useToast"
import { Button } from "@/components/ui/button"
import WorkspaceCard from "@/components/WorkspaceCard.vue"
import { MultiSelect } from "@/components/ui/multi-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const route = useRoute()
const router = useRouter()
const { loading: workspacesLoading, error, fetchAll, getById } = useWorkspaces()
const { data: projects, loading: projectsLoading, error: projectsError, fetchAll: fetchProjects } = useProjects()
const { data: rules, loading: rulesLoading, error: rulesError, fetchAll: fetchRules } = useRules()
const { setCurrentWorkspaceId, setCurrentProjectId } = useWorkspaceContext()
const { error: showError } = useToast()

const workspaceId = computed(() => Number(route.params.id))
const workspaceRules = useWorkspacesRelRules(workspaceId)
const workspace = computed(() => getById(workspaceId.value))
const errorMessage = ref<string | null>(null)
const showRuleSelector = computed(
  () => !workspace.value?.allRulesAvailableInWorkspace,
)

const workspaceProjects = computed(() =>
  projects.value.filter((project) => project.workspaceId === workspaceId.value),
)

const ruleOptions = computed(() =>
  rules.value.map((rule) => ({
    value: rule.id,
    label: rule.name,
    code: rule.code,
    searchText: `${rule.code} ${rule.name}`,
  }))
)

const selectedRuleIds = ref<Array<string | number>>([])
const isSyncingSelection = ref(false)

const isValidId = computed(() => Number.isInteger(workspaceId.value) && workspaceId.value > 0)

const loadingState = computed(() => workspacesLoading.value || projectsLoading.value)
const rulesLoadingCombined = computed(
  () => rulesLoading.value || workspaceRules.loading.value,
)
const rulesErrorCombined = computed(
  () => rulesError.value || workspaceRules.error.value || "",
)

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString()
}

function goToProject(id: number) {
  if (workspaceId.value) {
    setCurrentWorkspaceId(workspaceId.value)
  }
  setCurrentProjectId(id)
  router.push(`/projects/${id}`)
}

function goToProjects() {
  router.push("/projects")
}

async function fetchWorkspace() {
  if (!isValidId.value) {
    errorMessage.value = "Invalid workspace ID."
    return
  }
  errorMessage.value = null
  await fetchAll()
  await fetchProjects(workspaceId.value)
  await fetchRules()
  if (showRuleSelector.value) {
    await workspaceRules.fetchByWorkspaceId(workspaceId.value)
  }
  if (
    workspaceRules.linkedRuleIds.value.length === 0
    && rules.value.some((rule) => rule.id === 1)
    && !workspaceRules.isRuleLinked(1)
  ) {
    try {
      await workspaceRules.linkRule(1)
    } catch {
      // Ignore default rule link errors to avoid blocking the page.
    }
  }
  if (workspace.value) {
    setCurrentWorkspaceId(workspace.value.id)
  }
}

const isLoading = computed(() => loadingState.value)

watch(
  () => [isLoading.value, error.value, projectsError.value] as const,
  ([isLoadingValue, workspaceError, projectError]) => {
    if (isLoadingValue) return
    errorMessage.value = workspaceError || projectError || null
  },
  { immediate: true },
)

watch(
  () => workspaceId.value,
  async (value) => {
    if (!Number.isFinite(value)) return
    await fetchWorkspace()
    syncSelectionFromStore()
  },
)

onMounted(async () => {
  await fetchWorkspace()
})

watch(
  () => workspaceRules.linkedRuleIds.value,
  () => {
    if (!isSyncingSelection.value) {
      syncSelectionFromStore()
    }
  },
)

watch(
  () => selectedRuleIds.value,
  async (value) => {
    if (!isValidId.value) return
    if (isSyncingSelection.value) return
    const current = workspaceRules.linkedRuleIds.value
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
    const next = value.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    const toAdd = next.filter((id) => !current.includes(id))
    const toRemove = current.filter((id) => !next.includes(id))

    try {
      await Promise.all([
        ...toAdd.map((id) => workspaceRules.linkRule(id)),
        ...toRemove.map((id) => workspaceRules.unlinkRule(id)),
      ])
    } catch (error) {
      showError(
        "Failed to update workspace rules",
        error instanceof Error ? error.message : "Unknown error",
      )
      syncSelectionFromStore()
    }
  },
  { deep: true },
)

function syncSelectionFromStore() {
  isSyncingSelection.value = true
  selectedRuleIds.value = workspaceRules.linkedRuleIds.value.map((id) => id)
  queueMicrotask(() => {
    isSyncingSelection.value = false
  })
}
</script>
