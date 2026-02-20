import { storeToRefs } from "pinia"
import { onMounted, watch, computed } from "vue"
import { useAuthStore } from "@/auth"
import {
  useProjectsStore,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/stores/projects"
import { useWorkspaceContextStore } from "@/stores/workspaceContext"

export function useProjects() {
  const store = useProjectsStore()
  const workspaceContext = useWorkspaceContextStore()
  const { projects, loaded, loading, error } = storeToRefs(store)
  const { currentWorkspaceId } = storeToRefs(workspaceContext)
  const auth = useAuthStore()

  // Get projects for current workspace
  const currentWorkspaceProjects = computed(() => {
    if (!currentWorkspaceId.value) return []
    return store.getByWorkspaceId(currentWorkspaceId.value)
  })

  async function fetchAll(workspaceId?: number) {
    await store.fetchAll(workspaceId)
  }

  async function fetchIfEmpty(workspaceId?: number) {
    await store.fetchIfEmpty(workspaceId)
  }

  async function create(input: CreateProjectInput) {
    return store.create(input)
  }

  async function patch(id: number, updates: UpdateProjectInput) {
    return store.patch(id, updates)
  }

  async function remove(id: number) {
    return store.remove(id)
  }

  async function fetchById(id: number) {
    return store.fetchById(id)
  }

  // Auto-fetch when workspace changes
  if (import.meta.client) {
    onMounted(() => {
      watch(
        [() => auth.isAuthenticated, () => currentWorkspaceId.value],
        async ([isAuth, workspaceId]) => {
          if (isAuth && workspaceId) {
            await fetchIfEmpty(workspaceId)
          }
        },
        { immediate: true }
      )
    })
  }

  return {
    // State
    data: projects,
    currentWorkspaceProjects,
    loaded,
    loading,
    error,
    // Actions
    fetchAll,
    fetchIfEmpty,
    fetchById,
    create,
    patch,
    remove,
    getById: store.getById,
    getByWorkspaceId: store.getByWorkspaceId,
  }
}
