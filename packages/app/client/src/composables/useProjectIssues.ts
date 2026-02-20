import { computed, ref, watch } from "vue"
import { useIssues } from "@/composables/useIssues"
import { useToast } from "@/composables/useToast"
import type { AnalyzeJobStatus } from "@/stores/issues"

type AnalyzeMode = "replace_all" | "replace_ai" | "incremental"
type Effort = "sample" | "low" | "medium" | "high" | "extra_high"
type PendingAnalysis = { jobId: string; mode: AnalyzeMode }

export type IssuePayload = {
  title: string
  description?: string
  priority: "low" | "medium" | "high" | "critical"
  status: "open" | "in_progress" | "resolved" | "closed"
  documentIds: number[]
}

export function useProjectIssues(projectId: { value: number }, projectRules: { value: any[] }, documents: { value: any[] }) {
  const {
    create: createIssue,
    fetchByProjectId,
    analyzeStart,
    analyzeStatus,
    analyzeConsume,
    patch: patchIssue,
    remove: removeIssue,
  } = useIssues()
  const { success: showSuccess, error: showError } = useToast()

  const issues = ref<any[]>([])
  const issuesLoading = ref(false)
  const analyzingIssues = ref(false)
  const activeAnalysisJobId = ref<string | null>(null)
  const analyzeMode = ref<AnalyzeMode>("incremental")
  const effort = ref<Effort>("medium")

  function getEffortStorageKey(id: number) {
    return `harmonia:issues:effort:${id}`
  }

  function getAnalysisJobStorageKey(id: number) {
    return `harmonia:issues:analysis-job:${id}`
  }

  function getAnalyzeModeStorageKey(id: number) {
    return `harmonia:issues:analyze-mode:${id}`
  }

  function readAnalyzeMode(id: number): AnalyzeMode | null {
    if (!import.meta.client || !id) return null
    const stored = localStorage.getItem(getAnalyzeModeStorageKey(id))
    if (stored === "replace_all" || stored === "replace_ai" || stored === "incremental") {
      return stored
    }
    return null
  }

  function readPendingAnalysis(id: number): PendingAnalysis | null {
    if (!import.meta.client || !id) return null
    const raw = localStorage.getItem(getAnalysisJobStorageKey(id))
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<PendingAnalysis>
      if (!parsed || typeof parsed.jobId !== "string") return null
      if (
        parsed.mode !== "replace_all" &&
        parsed.mode !== "replace_ai" &&
        parsed.mode !== "incremental"
      ) {
        return null
      }
      return {
        jobId: parsed.jobId,
        mode: parsed.mode,
      }
    } catch {
      return null
    }
  }

  function writePendingAnalysis(id: number, pending: PendingAnalysis | null) {
    if (!import.meta.client || !id) return
    const key = getAnalysisJobStorageKey(id)
    if (!pending) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, JSON.stringify(pending))
  }

  watch(
    () => projectId.value,
    (id) => {
      if (!import.meta.client || !id) return
      const stored = localStorage.getItem(getEffortStorageKey(id))
      if (!stored) return
      if (stored === "sample" || stored === "low" || stored === "medium" || stored === "high" || stored === "extra_high") {
        effort.value = stored
      }
    },
    { immediate: true },
  )

  watch(
    () => projectId.value,
    (id) => {
      if (!import.meta.client || !id) return
      const stored = readAnalyzeMode(id)
      if (stored) {
        analyzeMode.value = stored
      }
    },
    { immediate: true },
  )

  watch(
    () => projectId.value,
    (id) => {
      if (!id) {
        activeAnalysisJobId.value = null
        return
      }
      const pending = readPendingAnalysis(id)
      activeAnalysisJobId.value = pending?.jobId ?? null
    },
    { immediate: true },
  )

  watch(
    () => [projectId.value, effort.value] as const,
    ([id, value]) => {
      if (!import.meta.client || !id) return
      localStorage.setItem(getEffortStorageKey(id), value)
    },
  )

  watch(
    () => [projectId.value, analyzeMode.value] as const,
    ([id, value]) => {
      if (!import.meta.client || !id) return
      localStorage.setItem(getAnalyzeModeStorageKey(id), value)
    },
  )

  const canAnalyzeIssues = computed(() => {
    return documents.value.length > 0 && projectRules.value.length > 0
  })

  const analyzeIssuesTooltip = computed(() => {
    if (analyzingIssues.value) {
      return "Running analysis..."
    }
    if (documents.value.length === 0 && projectRules.value.length === 0) {
      return "Add documents and link rules to enable analysis."
    }
    if (documents.value.length === 0) {
      return "Upload documents to enable analysis."
    }
    if (projectRules.value.length === 0) {
      return "Link rules to enable analysis."
    }
    return "Uses all project documents and effective rules."
  })

  async function fetchIssues() {
    issuesLoading.value = true
    try {
      issues.value = await fetchByProjectId(projectId.value)
    } catch {
      issues.value = []
    } finally {
      issuesLoading.value = false
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function waitForJob(jobId: string): Promise<AnalyzeJobStatus> {
    const timeoutMs = 10 * 60 * 1000
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
      let status: AnalyzeJobStatus | null
      try {
        status = await analyzeStatus(projectId.value, jobId)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        throw new Error(`Status polling failed: ${message}`)
      }

      if (status?.status === "completed") return status
      if (status?.status === "failed") {
        const message = status?.error || "Analysis job failed"
        throw new Error(`Analysis job failed: ${message}`)
      }

      await sleep(2000)
    }
    throw new Error("Analysis timed out")
  }

  function isResultNotReadyError(error: unknown) {
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return (
      message.includes("result not available") ||
      message.includes("analysis result is empty")
    )
  }

  async function handleAnalyzeIssues(mode = analyzeMode.value) {
    if (analyzingIssues.value) return
    analyzingIssues.value = true
    try {
      const pending = readPendingAnalysis(projectId.value)
      let jobId: string
      let consumeMode: AnalyzeMode

      if (pending) {
        jobId = pending.jobId
        consumeMode = pending.mode
      } else {
        const started = await analyzeStart(projectId.value, { mode, effort: effort.value })
        jobId = started.jobId
        consumeMode = mode
        writePendingAnalysis(projectId.value, { jobId, mode: consumeMode })
      }

      activeAnalysisJobId.value = jobId
      if (pending) {
        try {
          await analyzeConsume(projectId.value, jobId, { mode: consumeMode })
          writePendingAnalysis(projectId.value, null)
          activeAnalysisJobId.value = null
          await fetchIssues()
          showSuccess("Analysis complete", "Issues have been generated from the documents.")
          return
        } catch (error) {
          if (!isResultNotReadyError(error)) {
            const message = error instanceof Error ? error.message : "Unknown error"
            throw new Error(`Result consume failed: ${message}`)
          }
        }
      }

      let status: AnalyzeJobStatus | null
      try {
        status = await waitForJob(jobId)
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Status polling failed:")) {
          try {
            await analyzeConsume(projectId.value, jobId, { mode: consumeMode })
            writePendingAnalysis(projectId.value, null)
            activeAnalysisJobId.value = null
            await fetchIssues()
            showSuccess("Analysis complete", "Issues have been generated from the documents.")
            return
          } catch (consumeError) {
            const consumeMessage =
              consumeError instanceof Error ? consumeError.message : "Unknown error"
            throw new Error(`Status polling failed and consume retry failed: ${consumeMessage}`)
          }
        }
        throw error
      }

      if (status?.status === "completed") {
        try {
          await analyzeConsume(projectId.value, jobId, { mode: consumeMode })
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error"
          throw new Error(`Result consume failed: ${message}`)
        }
        writePendingAnalysis(projectId.value, null)
        activeAnalysisJobId.value = null
        await fetchIssues()
        showSuccess("Analysis complete", "Issues have been generated from the documents.")
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Analysis job failed:")) {
        writePendingAnalysis(projectId.value, null)
        activeAnalysisJobId.value = null
      }
      showError("Failed to analyze issues", e instanceof Error ? e.message : "Unknown error")
    } finally {
      analyzingIssues.value = false
    }
  }

  async function toggleNonIssue(issue: any) {
    try {
      const mark = !issue.markedAsNonissueAt
      await patchIssue(issue.id, { markNonIssue: mark })
      await fetchIssues()
    } catch (e) {
      showError("Failed to update issue", e instanceof Error ? e.message : "Unknown error")
    }
  }

  async function handleCreateIssue(payload: IssuePayload) {
    try {
      await createIssue({
        title: payload.title.trim(),
        description: payload.description?.trim() || undefined,
        priority: payload.priority,
        status: payload.status,
        projectId: projectId.value,
        documentIds: payload.documentIds,
      })
      showSuccess("Issue created", "The issue has been created successfully.")
      await fetchIssues()
    } catch (e) {
      showError("Failed to create issue", e instanceof Error ? e.message : "Unknown error")
    }
  }

  async function handleDeleteIssue(issue: { id: number; title?: string }) {
    try {
      await removeIssue(issue.id)
      issues.value = issues.value.filter((item) => item.id !== issue.id)
      showSuccess("Issue deleted", `"${issue.title || "Issue"}" has been removed.`)
      await fetchIssues()
    } catch (e) {
      showError("Failed to delete issue", e instanceof Error ? e.message : "Unknown error")
    }
  }

  return {
    issues,
    issuesLoading,
    analyzingIssues,
    activeAnalysisJobId,
    analyzeMode,
    effort,
    canAnalyzeIssues,
    analyzeIssuesTooltip,
    fetchIssues,
    handleAnalyzeIssues,
    toggleNonIssue,
    handleCreateIssue,
    handleDeleteIssue,
  }
}
