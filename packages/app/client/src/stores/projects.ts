import { ref, computed } from "vue"
import { defineStore } from "pinia"

export interface Project {
  id: number
  name: string
  description: string | null
  workspaceId: number
  createdAt: number
  updatedAt: number
  documentsCount?: number
  rulesCount?: number
  issuesCount?: number
}

export interface CreateProjectInput {
  name: string
  description?: string
  workspaceId: number
}

export interface UpdateProjectInput {
  name?: string
  description?: string
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

function buildUrl(path: string): string {
  if (API_URL === "/" || API_URL === "") {
    return path.startsWith("/") ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export const useProjectsStore = defineStore("projects", () => {
  // State
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // Getters
  const projectsByWorkspace = computed(() => {
    const map = new Map<number, Project[]>()
    for (const project of projects.value) {
      const list = map.get(project.workspaceId) || []
      list.push(project)
      map.set(project.workspaceId, list)
    }
    return map
  })

  function getById(id: number): Project | undefined {
    return projects.value.find((p) => p.id === id)
  }

  function getByWorkspaceId(workspaceId: number): Project[] {
    return projects.value.filter((p) => p.workspaceId === workspaceId)
  }

  // Actions
  async function fetchAll(workspaceId?: number) {
    loading.value = true
    error.value = null

    try {
      const url = workspaceId
        ? buildUrl(`/api/projects?workspace_id=${workspaceId}`)
        : buildUrl("/api/projects")

      const response = await fetch(url, {
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 401) {
          projects.value = []
          loaded.value = true
          return
        }
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch projects (HTTP ${response.status})`
        const err = new Error(errorMessage)
        if (errorData?.error?.code) (err as any).code = errorData.error.code
        throw err
      }

      const data = (await response.json()) as any

      // If fetching all, replace all. If fetching for specific workspace, merge.
      if (workspaceId === undefined) {
        projects.value = data.data || []
      } else {
        const newProjects = data.data || []
        // Remove old projects for this workspace
        const otherProjects = projects.value.filter((p) => p.workspaceId !== workspaceId)
        projects.value = [...otherProjects, ...newProjects]
      }

      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
    } finally {
      loading.value = false
    }
  }

  async function fetchIfEmpty(workspaceId?: number) {
    if (!loaded.value && projects.value.length === 0) {
      await fetchAll(workspaceId)
    }
  }

  async function fetchById(id: number): Promise<Project> {
    // Check if we already have it
    const existing = getById(id)
    if (existing) {
      return existing
    }

    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/projects/${id}`), {
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Project not found")
        }
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch project (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const project = data.data as Project
      
      // Add to store if not already there
      if (!getById(project.id)) {
        projects.value.push(project)
      }
      
      return project
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(input: CreateProjectInput): Promise<Project> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl("/api/projects"), {
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
          `Failed to create project (HTTP ${response.status})`
        const err = new Error(errorMessage)
        if (errorData?.error?.code) (err as any).code = errorData.error.code
        throw err
      }

      const data = (await response.json()) as any
      const project = data.data as Project
      projects.value.push(project)
      return project
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function patch(id: number, updates: UpdateProjectInput): Promise<Project> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/projects/${id}`), {
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
          `Failed to update project (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const updated = data.data as Project

      const index = projects.value.findIndex((p) => p.id === id)
      if (index !== -1) {
        projects.value[index] = updated
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
      const response = await fetch(buildUrl(`/api/projects/${id}`), {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to delete project (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      projects.value = projects.value.filter((p) => p.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    projects,
    loading,
    error,
    loaded,
    // Getters
    projectsByWorkspace,
    getById,
    getByWorkspaceId,
    // Actions
    fetchAll,
    fetchIfEmpty,
    fetchById,
    create,
    patch,
    remove,
  }
})
