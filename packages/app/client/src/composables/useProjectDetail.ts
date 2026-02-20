import { computed, ref, watch } from "vue"
import { useRoute } from "vue-router"
import { useProjects } from "@/composables/useProjects"
import { useToast } from "@/composables/useToast"
import { useWorkspaceContext } from "@/composables/useWorkspaceContext"
import { useDocuments } from "@/composables/useDocuments"
import { useProjectRulesPanel } from "@/composables/useProjectRulesPanel"
import { useProjectIssues } from "@/composables/useProjectIssues"

export function useProjectDetail() {
  const route = useRoute()
  const { fetchById, patch, remove, loading, error } = useProjects()
  const { success: showSuccess, error: showError } = useToast()
  const { setCurrentWorkspaceId, setCurrentProjectId, currentWorkspace } = useWorkspaceContext()

  const projectId = computed(() => parseInt(route.params.id as string, 10))
  const project = ref<any>(null)
  const activeTab = ref("documents")

  const { documents, fetchByProjectId: fetchDocuments } = useDocuments(projectId)

  const workspaceId = computed(() => project.value?.workspaceId as number | undefined)
  const projectRulesPanel = useProjectRulesPanel(
    projectId,
    workspaceId,
    computed(() => currentWorkspace.value?.allRulesAvailableInWorkspace),
  )
  const projectIssues = useProjectIssues(projectId, projectRulesPanel.projectRules, documents)

  const editProject = ref({
    name: "",
    description: "",
  })

  const hasChanges = computed(() => {
    return (
      editProject.value.name !== project.value?.name ||
      editProject.value.description !== project.value?.description
    )
  })

  async function fetchProject() {
    try {
      project.value = await fetchById(projectId.value)
      if (project.value?.workspaceId) {
        setCurrentWorkspaceId(project.value.workspaceId)
      }
      if (project.value?.id) {
        setCurrentProjectId(project.value.id)
      }
      editProject.value = {
        name: project.value.name,
        description: project.value.description || "",
      }
      await projectIssues.fetchIssues()
      if (activeTab.value === "documents" && projectIssues.issues.value.length > 0) {
        activeTab.value = "issues"
      }
      await fetchDocuments(projectId.value).catch(() => {
        // Silently handle document fetch errors
      })
      await projectRulesPanel.fetchRulesPanelData()
    } catch (e) {
      showError("Failed to load project", e instanceof Error ? e.message : "Unknown error")
    }
  }

  async function handleUpdate() {
    try {
      await patch(projectId.value, {
        name: editProject.value.name,
        description: editProject.value.description || undefined,
      })
      showSuccess("Project updated", "Project details have been saved.")
      await fetchProject()
    } catch (e) {
      showError("Failed to update project", e instanceof Error ? e.message : "Unknown error")
    }
  }

  async function handleDelete(onSuccess: () => void) {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return
    }
    try {
      await remove(projectId.value)
      showSuccess("Project deleted", "The project has been deleted.")
      onSuccess()
    } catch (e) {
      showError("Failed to delete project", e instanceof Error ? e.message : "Unknown error")
    }
  }

  watch(() => route.params.id, fetchProject, { immediate: true })

  return {
    projectId,
    project,
    activeTab,
    loading,
    error,
    documents,
    editProject,
    hasChanges,
    fetchProject,
    handleUpdate,
    handleDelete,
    projectRulesPanel,
    projectIssues,
  }
}
