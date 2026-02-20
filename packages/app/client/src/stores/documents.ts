import { ref } from "vue"
import { defineStore } from "pinia"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

function buildUrl(path: string): string {
  if (API_URL === "/" || API_URL === "") {
    return path.startsWith("/") ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export interface ProjectDocument {
  id: number
  projectId: number
  filename: string
  fileType: string
  status: string
  createdAt?: number
  updatedAt?: number
}

export const useDocumentsStore = defineStore("documents", () => {
  const documentsByProjectId = ref<Record<number, ProjectDocument[]>>({})
  const loadingByProjectId = ref<Record<number, boolean>>({})
  const errorByProjectId = ref<Record<number, string | null>>({})

  function getByProjectId(projectId: number): ProjectDocument[] {
    return documentsByProjectId.value[projectId] || []
  }

  function isLoading(projectId: number): boolean {
    return Boolean(loadingByProjectId.value[projectId])
  }

  function getError(projectId: number): string | null {
    return errorByProjectId.value[projectId] || null
  }

  async function fetchByProjectId(projectId: number): Promise<ProjectDocument[]> {
    loadingByProjectId.value[projectId] = true
    errorByProjectId.value[projectId] = null
    try {
      const response = await fetch(buildUrl(`/documents?project_id=${projectId}`), {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch documents (HTTP ${response.status})`)
      }
      const data = (await response.json()) as { data?: ProjectDocument[] }
      documentsByProjectId.value[projectId] = data.data ?? []
      return documentsByProjectId.value[projectId]
    } catch (error) {
      errorByProjectId.value[projectId] = error instanceof Error ? error.message : "Unknown error"
      documentsByProjectId.value[projectId] = []
      throw error
    } finally {
      loadingByProjectId.value[projectId] = false
    }
  }

  async function uploadFile(projectId: number, file: File): Promise<void> {
    const form = new FormData()
    form.append("projectId", String(projectId))
    form.append("file", file)

    const response = await fetch(buildUrl("/documents/upload"), {
      method: "POST",
      credentials: "include",
      body: form,
    })
    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as any
      const message =
        errorData?.error?.message
        || errorData?.error
        || `Failed to upload document (HTTP ${response.status})`
      throw new Error(message)
    }
  }

  async function uploadContent(
    projectId: number,
    filename: string,
    fileType: "txt" | "md",
    content: string,
  ): Promise<void> {
    const response = await fetch(buildUrl("/documents/upload"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        projectId,
        filename,
        fileType,
        content,
      }),
    })
    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as any
      const message =
        errorData?.error?.message
        || errorData?.error
        || `Failed to upload document (HTTP ${response.status})`
      throw new Error(message)
    }
  }

  async function deleteDocument(documentId: number, projectId: number): Promise<void> {
    const response = await fetch(buildUrl(`/documents/${documentId}`), {
      method: "DELETE",
      credentials: "include",
    })
    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as any
      const message =
        errorData?.error?.message
        || errorData?.error
        || `Failed to delete document (HTTP ${response.status})`
      throw new Error(message)
    }
    const current = documentsByProjectId.value[projectId] || []
    documentsByProjectId.value[projectId] = current.filter((doc) => doc.id !== documentId)
  }

  return {
    documentsByProjectId,
    loadingByProjectId,
    errorByProjectId,
    getByProjectId,
    isLoading,
    getError,
    fetchByProjectId,
    uploadFile,
    uploadContent,
    deleteDocument,
  }
})
