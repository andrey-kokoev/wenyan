import { ref, computed } from "vue"
import { defineStore } from "pinia"

export interface Issue {
  id: number
  title: string
  description: string | null
  priority: "low" | "medium" | "high" | "critical"
  status: "open" | "in_progress" | "resolved" | "closed"
  projectId: number
  markedAsNonissueBy?: string | null
  markedAsNonissueAt?: number | null
  createdAt: number
  updatedAt: number
}

export interface IssueWithDocuments extends Issue {
  documents: Array<{
    id: number
    filename: string
    anchor?: {
      type?: string | null
      start?: number | null
      end?: number | null
      text?: string | null
    }
  }>
  ruleIds?: number[]
}

export interface AnalyzeStartResult {
  jobId: string
}

export interface AnalyzeJobStatus {
  jobId: string
  status: "queued" | "running" | "completed" | "failed"
  httpStatus?: number | null
  responseKey?: string | null
  error?: string | null
  createdAt: number
  updatedAt: number
}

export interface AnalyzeConsumeResult {
  issues: IssueWithDocuments[]
  skippedCount?: number
  alreadyConsumed?: boolean
}

export interface CreateIssueInput {
  title: string
  description?: string
  priority: "low" | "medium" | "high" | "critical"
  status: "open" | "in_progress" | "resolved" | "closed"
  projectId: number
  documentIds?: number[]
}

export interface UpdateIssueInput {
  title?: string
  description?: string
  priority?: "low" | "medium" | "high" | "critical"
  status?: "open" | "in_progress" | "resolved" | "closed"
  documentIds?: number[]
  markNonIssue?: boolean
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

function buildUrl(path: string): string {
  if (API_URL === "/" || API_URL === "") {
    return path.startsWith("/") ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export const useIssuesStore = defineStore("issues", () => {
  // State
  const issues = ref<IssueWithDocuments[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // Getters
  const issuesByProject = computed(() => {
    const map = new Map<number, IssueWithDocuments[]>()
    for (const issue of issues.value) {
      const list = map.get(issue.projectId) || []
      list.push(issue)
      map.set(issue.projectId, list)
    }
    return map
  })

  function getById(id: number): IssueWithDocuments | undefined {
    return issues.value.find((i) => i.id === id)
  }

  function getByProjectId(projectId: number): IssueWithDocuments[] {
    return issues.value.filter((i) => i.projectId === projectId)
  }

  // Actions
  async function fetchAll(projectId?: number) {
    loading.value = true
    error.value = null

    try {
      const url = projectId
        ? buildUrl(`/api/issues?project_id=${projectId}`)
        : buildUrl("/api/issues")

      const response = await fetch(url, {
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 401) {
          issues.value = []
          loaded.value = true
          return
        }
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch issues (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any

      if (projectId === undefined) {
        issues.value = data.data || []
      } else {
        const newIssues = data.data || []
        const otherIssues = issues.value.filter((i) => i.projectId !== projectId)
        issues.value = [...otherIssues, ...newIssues]
      }

      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
    } finally {
      loading.value = false
    }
  }

  async function fetchByProjectId(projectId: number): Promise<IssueWithDocuments[]> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/issues?project_id=${projectId}`), {
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch issues (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const newIssues = data.data || []
      
      // Update store
      const otherIssues = issues.value.filter((i) => i.projectId !== projectId)
      issues.value = [...otherIssues, ...newIssues]
      
      return newIssues
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number): Promise<IssueWithDocuments> {
    const existing = getById(id)
    if (existing) {
      return existing
    }

    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/issues/${id}`), {
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Issue not found")
        }
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch issue (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const issue = data.data as IssueWithDocuments

      if (!getById(issue.id)) {
        issues.value.push(issue)
      }

      return issue
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(input: CreateIssueInput): Promise<IssueWithDocuments> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl("/api/issues"), {
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
          `Failed to create issue (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const issue = data.data as IssueWithDocuments
      issues.value.push(issue)
      return issue
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function patch(id: number, updates: UpdateIssueInput): Promise<IssueWithDocuments> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/issues/${id}`), {
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
          `Failed to update issue (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const updated = data.data as IssueWithDocuments

      const index = issues.value.findIndex((i) => i.id === id)
      if (index !== -1) {
        issues.value[index] = updated
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
      const response = await fetch(buildUrl(`/api/issues/${id}`), {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to delete issue (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      issues.value = issues.value.filter((i) => i.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function analyzeStart(
    projectId: number,
    input: {
      mode: "replace_all" | "replace_ai" | "incremental"
      effort?: "sample" | "low" | "medium" | "high" | "extra_high"
    },
  ): Promise<AnalyzeStartResult> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/projects/${projectId}/issues/analyze`), {
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
          `Failed to analyze issues (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const jobId = data?.data?.jobId
      if (!jobId) {
        throw new Error("Missing analysis job ID")
      }
      return { jobId }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function analyzeStatus(projectId: number, jobId: string): Promise<AnalyzeJobStatus | null> {
    const response = await fetch(buildUrl(`/api/projects/${projectId}/issues/analyze/${jobId}`), {
      method: "GET",
      credentials: "include",
    })
    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as any
      const errorMessage =
        errorData?.error?.message ||
        errorData?.error ||
        `Failed to fetch analysis status (HTTP ${response.status})`
      throw new Error(errorMessage)
    }
    const data = (await response.json()) as { data?: AnalyzeJobStatus }
    return data?.data ?? null
  }

  async function analyzeConsume(
    projectId: number,
    jobId: string,
    input: {
      mode: "replace_all" | "replace_ai" | "incremental"
      documentIds?: number[]
    },
  ): Promise<AnalyzeConsumeResult> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(
        buildUrl(`/api/projects/${projectId}/issues/analyze/${jobId}/consume`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(input),
        },
      )
      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to consume analysis (HTTP ${response.status})`
        throw new Error(errorMessage)
      }
      const data = (await response.json()) as { data?: AnalyzeConsumeResult }
      return {
        issues: (data?.data?.issues || []) as IssueWithDocuments[],
        skippedCount: data?.data?.skippedCount,
        alreadyConsumed: data?.data?.alreadyConsumed,
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    issues,
    loading,
    error,
    loaded,
    // Getters
    issuesByProject,
    getById,
    getByProjectId,
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
  }
})
