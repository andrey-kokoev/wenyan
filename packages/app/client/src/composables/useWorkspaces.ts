import { storeToRefs } from "pinia"
import { onMounted, watch } from "vue"
import { useAuthStore } from "@/auth"
import { useWorkspacesStore, type CreateWorkspaceInput, type UpdateWorkspaceInput } from "@/stores/workspaces"

export function useWorkspaces() {
  const store = useWorkspacesStore()
  const { workspaces, loaded, loading, error } = storeToRefs(store)
  const auth = useAuthStore()

  async function fetchAll() {
    await store.fetchAll()
  }

  async function fetchIfEmpty() {
    await store.fetchIfEmpty()
  }

  async function create(input: CreateWorkspaceInput) {
    return store.create(input)
  }

  async function patch(id: number, updates: UpdateWorkspaceInput) {
    return store.patch(id, updates)
  }

  async function remove(id: number) {
    return store.remove(id)
  }

  async function clone(id: number) {
    return store.clone(id)
  }

  // Auto-fetch when component mounts (if already authenticated) or when user logs in
  if (import.meta.client) {
    onMounted(async () => {
      // Fetch immediately if already authenticated
      if (auth.isAuthenticated) {
        await fetchIfEmpty()
      }
      
      // Also watch for auth changes
      watch(
        () => auth.isAuthenticated,
        async (isAuth) => {
          if (isAuth) {
            await fetchIfEmpty()
          }
        }
      )
    })
  }

  return {
    // State
    data: workspaces,
    loaded,
    loading,
    error,
    // Actions
    fetchAll,
    fetchIfEmpty,
    create,
    patch,
    remove,
    clone,
    getById: store.getById,
  }
}
