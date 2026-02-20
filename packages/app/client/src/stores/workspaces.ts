import { ref, computed } from "vue"
import { defineStore } from "pinia"

export interface Workspace {
  id: number
  name: string
  ownerId: string
  isPersonal: boolean
  allRulesAvailableInWorkspace: boolean
  createdAt: number
  updatedAt: number
}

export interface CreateWorkspaceInput {
  name: string
  allRulesAvailableInWorkspace?: boolean
}

export interface UpdateWorkspaceInput {
  name?: string
  allRulesAvailableInWorkspace?: boolean
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

function buildUrl(path: string): string {
  if (API_URL === "/" || API_URL === "") {
    return path.startsWith("/") ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export const useWorkspacesStore = defineStore("workspaces", () => {
  // State
  const workspaces = ref<Workspace[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // Getters
  const personalWorkspace = computed(() => workspaces.value.find((w) => w.isPersonal))

  const nonPersonalWorkspaces = computed(() => workspaces.value.filter((w) => !w.isPersonal))

  function getById(id: number): Workspace | undefined {
    return workspaces.value.find((w) => w.id === id)
  }

  // Actions
  async function fetchAll() {
    loading.value = true
    error.value = null

    try {
      const url = buildUrl("/api/workspaces")
      const response = await fetch(url, {
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 401) {
          workspaces.value = []
          loaded.value = true
          return
        }
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch workspaces (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      workspaces.value = data.data || []
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
    } finally {
      loading.value = false
    }
  }

  async function fetchIfEmpty() {
    if (!loaded.value && workspaces.value.length === 0) {
      await fetchAll()
    }
  }

  async function create(input: CreateWorkspaceInput): Promise<Workspace> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl("/api/workspaces"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to create workspace (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const workspace = data.data as Workspace
      workspaces.value.push(workspace)
      return workspace
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function patch(id: number, updates: UpdateWorkspaceInput): Promise<Workspace> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/workspaces/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to update workspace (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const updated = data.data as Workspace

      const index = workspaces.value.findIndex((w) => w.id === id)
      if (index !== -1) {
        workspaces.value[index] = updated
      }

      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/workspaces/${id}`), {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to delete workspace (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      workspaces.value = workspaces.value.filter((w) => w.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function clone(id: number): Promise<Workspace> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/workspaces/${id}/clone`), {
        method: "POST",
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to clone workspace (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const workspace = data.data as Workspace
      workspaces.value.push(workspace)
      return workspace
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    workspaces,
    loading,
    error,
    loaded,
    // Getters
    personalWorkspace,
    nonPersonalWorkspaces,
    getById,
    // Actions
    fetchAll,
    fetchIfEmpty,
    create,
    patch,
    remove,
    clone,
  }
})
