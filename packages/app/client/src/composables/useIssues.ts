import { storeToRefs } from "pinia"
import { onMounted, watch, computed } from "vue"
import { useAuthStore } from "@/auth"
import {
  useIssuesStore,
  type CreateIssueInput,
  type UpdateIssueInput,
} from "@/stores/issues"
import { useWorkspaceContextStore } from "@/stores/workspaceContext"

export function useIssues() {
  const store = useIssuesStore()
  const workspaceContext = useWorkspaceContextStore()
  const { issues, loaded, loading, error } = storeToRefs(store)
  const { currentProjectId } = storeToRefs(workspaceContext)
  const auth = useAuthStore()

  // Get issues for current project
  const currentProjectIssues = computed(() => {
    if (!currentProjectId.value) return []
    return store.getByProjectId(currentProjectId.value)
  })

  async function fetchAll(projectId?: number) {
    await store.fetchAll(projectId)
  }

  async function fetchByProjectId(projectId: number) {
    return store.fetchByProjectId(projectId)
  }

  async function fetchById(id: number) {
    return store.fetchById(id)
  }

  async function create(input: CreateIssueInput) {
    return store.create(input)
  }

  async function patch(id: number, updates: UpdateIssueInput) {
    return store.patch(id, updates)
  }

  async function remove(id: number) {
    return store.remove(id)
  }

  async function analyzeStart(
    projectId: number,
    input: { mode: "replace_all" | "replace_ai" | "incremental"; effort?: "sample" | "low" | "medium" | "high" | "extra_high" },
  ) {
    return store.analyzeStart(projectId, input)
  }

  async function analyzeStatus(projectId: number, jobId: string) {
    return store.analyzeStatus(projectId, jobId)
  }

  async function analyzeConsume(
    projectId: number,
    jobId: string,
    input: { mode: "replace_all" | "replace_ai" | "incremental"; documentIds?: number[] },
  ) {
    return store.analyzeConsume(projectId, jobId, input)
  }

  // Auto-fetch when project changes
  if (import.meta.client) {
    onMounted(() => {
      watch(
        [() => auth.isAuthenticated, () => currentProjectId.value],
        async ([isAuth, projectId]) => {
          if (isAuth && projectId) {
            await fetchByProjectId(projectId)
          }
        },
        { immediate: true }
      )
    })
  }

  return {
    // State
    data: issues,
    currentProjectIssues,
    loaded,
    loading,
    error,
    // Actions
    fetchAll,
    fetchByProjectId,
    fetchById,
    create,
    patch,
    remove,
    analyzeStart,
    analyzeStatus,
    analyzeConsume,
    getById: store.getById,
    getByProjectId: store.getByProjectId,
  }
}
