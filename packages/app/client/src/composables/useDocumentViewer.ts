import { computed, ref } from "vue"
import { useToast } from "@/composables/useToast"
import type { IssueWithDocuments } from "@/stores/issues"

export type DocumentAnchor = {
  type?: "line" | "span" | "quote" | null
  start?: number | null
  end?: number | null
  text?: string | null
}

export type DocumentRef = {
  id: number
  filename: string
  anchor?: DocumentAnchor
}

type DocumentRefInput = {
  id: number
  filename: string
  anchor?: {
    type?: string | null
    start?: number | null
    end?: number | null
    text?: string | null
  }
}

export type IssueRef = IssueWithDocuments

export function useDocumentViewer(issues: { value: IssueWithDocuments[] }) {
  const { success: showSuccess, error: showError } = useToast()

  const showDocumentDialog = ref(false)
  const selectedDocument = ref<{ id: number; filename: string } | null>(null)
  const selectedAnchor = ref<{
    docId: number
    filename: string
    issueId?: number
    issueTitle?: string
    anchor?: DocumentAnchor
  } | null>(null)
  const isAnchorDialogOpen = ref(false)
  const isAnchorPinned = ref(false)
  const documentContentById = ref<Record<number, string>>({})
  const isDocumentLoading = ref(false)
  const documentLoadError = ref<string | null>(null)

  const PIN_STORAGE_KEY = "harmonia:document-evidence-pinned"
  if (import.meta.client) {
    const storedPinned = localStorage.getItem(PIN_STORAGE_KEY)
    if (storedPinned === "true") {
      isAnchorPinned.value = true
    }
  }

  const selectedIssueIndex = computed(() => {
    if (!selectedAnchor.value?.issueId) return -1
    return issues.value.findIndex((issue) => issue.id === selectedAnchor.value?.issueId)
  })

  const selectedIssue = computed(() => {
    if (selectedIssueIndex.value < 0) return null
    return issues.value[selectedIssueIndex.value] || null
  })

  const canNavigateAnchors = computed(() => {
    return (selectedIssue.value?.documents || []).length > 1
  })

  const selectedIssueContent = computed(() => {
    if (!selectedAnchor.value) return ""
    return documentContentById.value[selectedAnchor.value.docId] || ""
  })

  const selectedDocumentId = computed(() => selectedAnchor.value?.docId ?? null)

  const issuesForSelectedDoc = computed(() => {
    if (!selectedDocumentId.value) return []
    return issues.value.filter((issue) => {
      const docs = issue.documents || []
      return docs.some((doc) => doc.id === selectedDocumentId.value)
    })
  })

  const selectedModalContent = computed(() => {
    if (!selectedDocument.value) return ""
    return documentContentById.value[selectedDocument.value.id] || ""
  })

  const selectedLines = computed(() => {
    if (!selectedIssueContent.value) return []
    return selectedIssueContent.value.split("\n")
  })

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
  }

  const highlightedContent = computed(() => {
    const content = selectedIssueContent.value
    if (!content) return ""
    const anchor = selectedAnchor.value?.anchor
    if (anchor?.type === "quote" && anchor.text) {
      const safe = escapeHtml(content)
      const escapedQuote = escapeHtml(anchor.text)
      return safe.split(escapedQuote).join(`<mark class=\"bg-warning/40 text-foreground\">${escapedQuote}</mark>`)
    }
    return escapeHtml(content)
  })

  function normalizeDocumentRef(doc: DocumentRefInput): DocumentRef {
    const type = doc.anchor?.type
    const normalizedType =
      type === "line" || type === "span" || type === "quote" ? type : null
    return {
      id: doc.id,
      filename: doc.filename,
      anchor: doc.anchor
        ? {
            type: normalizedType,
            start: doc.anchor.start ?? null,
            end: doc.anchor.end ?? null,
            text: doc.anchor.text ?? null,
          }
        : undefined,
    }
  }

  function openDocumentPreview(doc: DocumentRefInput, issue?: IssueRef) {
    const normalized = normalizeDocumentRef(doc)
    selectedAnchor.value = {
      docId: normalized.id,
      filename: normalized.filename,
      issueId: issue?.id,
      issueTitle: issue?.title,
      anchor: normalized.anchor,
    }
    isAnchorDialogOpen.value = true
    void loadDocumentContent(normalized.id)
  }

  function openProjectDocumentModal(doc: DocumentRefInput) {
    selectedDocument.value = {
      id: doc.id,
      filename: doc.filename,
    }
    showDocumentDialog.value = true
    void loadDocumentContent(doc.id)
  }

  function closeDocumentModal() {
    showDocumentDialog.value = false
    selectedDocument.value = null
    documentLoadError.value = null
  }

  function closeDocumentPreview() {
    isAnchorDialogOpen.value = false
    selectedAnchor.value = null
    documentLoadError.value = null
  }

  function togglePinned() {
    isAnchorPinned.value = !isAnchorPinned.value
    if (import.meta.client) {
      localStorage.setItem(PIN_STORAGE_KEY, isAnchorPinned.value ? "true" : "false")
    }
  }

  function selectIssueAnchor(offset: number) {
    if (!selectedIssue.value || selectedIssueIndex.value < 0) return
    const docs = selectedIssue.value.documents || []
    if (docs.length === 0) return
    const currentDocId = selectedAnchor.value?.docId
    const currentIndex = docs.findIndex((doc) => doc.id === currentDocId)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + offset + docs.length) % docs.length
    openDocumentPreview(docs[nextIndex], selectedIssue.value)
  }

  function handleEvidenceClose() {
    if (isAnchorPinned.value) {
      isAnchorPinned.value = false
      if (import.meta.client) {
        localStorage.setItem(PIN_STORAGE_KEY, "false")
      }
    }
    closeDocumentPreview()
  }

  async function copyAnchorText() {
    const text = selectedAnchor.value?.anchor?.text
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      showSuccess("Copied", "Anchor text copied to clipboard.")
    } catch {
      showError("Copy failed", "Unable to copy anchor text.")
    }
  }

  async function loadDocumentContent(documentId: number) {
    if (documentContentById.value[documentId]) return
    isDocumentLoading.value = true
    documentLoadError.value = null
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8787"
      const url = baseUrl === "/" || baseUrl === "" ? `/documents/${documentId}` : `${baseUrl}/documents/${documentId}`
      const response = await fetch(url, { credentials: "include" })
      if (!response.ok) {
        throw new Error(`Failed to load document (HTTP ${response.status})`)
      }
      const data = (await response.json()) as any
      documentContentById.value = {
        ...documentContentById.value,
        [documentId]: data?.data?.content || "",
      }
    } catch (error) {
      documentLoadError.value = error instanceof Error ? error.message : "Failed to load document"
    } finally {
      isDocumentLoading.value = false
    }
  }

  return {
    showDocumentDialog,
    selectedDocument,
    selectedAnchor,
    isAnchorDialogOpen,
    isAnchorPinned,
    documentContentById,
    isDocumentLoading,
    documentLoadError,
    canNavigateAnchors,
    selectedModalContent,
    selectedLines,
    selectedIssueContent,
    selectedDocumentId,
    issuesForSelectedDoc,
    highlightedContent,
    openDocumentPreview,
    openProjectDocumentModal,
    closeDocumentModal,
    togglePinned,
    selectIssueAnchor,
    handleEvidenceClose,
    copyAnchorText,
  }
}
