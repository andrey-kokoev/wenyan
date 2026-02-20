import { ref, computed, watch } from "vue"
import { defineStore, storeToRefs } from "pinia"
import { useWorkspacesStore } from "./workspaces"
import { useProjectsStore } from "./projects"

const STORAGE_KEY = "harmonia:current-workspace-id"

export const useWorkspaceContextStore = defineStore("workspaceContext", () => {
  const workspacesStore = useWorkspacesStore()
  const projectsStore = useProjectsStore()
  const { workspaces } = storeToRefs(workspacesStore)

  // State
  const currentWorkspaceId = ref<number | null>(null)
  const currentProjectId = ref<number | null>(null)
  const initialized = ref(false)

  // Getters
  const currentWorkspace = computed(() => {
    if (!currentWorkspaceId.value) return undefined
    return workspacesStore.getById(currentWorkspaceId.value)
  })

  const currentProject = computed(() => {
    if (!currentProjectId.value) return undefined
    return projectsStore.getById(currentProjectId.value)
  })

  const availableProjects = computed(() => {
    if (!currentWorkspaceId.value) return []
    return projectsStore.getByWorkspaceId(currentWorkspaceId.value)
  })

  // Actions
  function init() {
    if (initialized.value) return

    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed)) {
        currentWorkspaceId.value = parsed
      }
    }

    // Watch for workspace changes and ensure valid selection
    watch(
      () => workspaces.value,
      (ws) => {
        if (ws.length === 0) return

        const ids = ws.map((w) => w.id)

        // If current selection is invalid, pick a default
        if (
          !currentWorkspaceId.value ||
          !ids.includes(currentWorkspaceId.value)
        ) {
          // Prefer personal workspace
          const personal = ws.find((w) => w.isPersonal)
          currentWorkspaceId.value = personal?.id ?? ws[0]?.id ?? null
        }
      },
      { immediate: true }
    )

    // Persist changes to localStorage
    watch(
      () => currentWorkspaceId.value,
      (id) => {
        if (id !== null) {
          localStorage.setItem(STORAGE_KEY, String(id))
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    )

    // Fetch projects when workspace changes
    watch(
      () => currentWorkspaceId.value,
      async (id) => {
        if (id !== null) {
          await projectsStore.fetchAll(id)
          // Clear project selection if it's not in the new workspace
          const workspaceProjects = projectsStore.getByWorkspaceId(id)
          const projectIds = workspaceProjects.map((p) => p.id)
          if (
            currentProjectId.value &&
            !projectIds.includes(currentProjectId.value)
          ) {
            currentProjectId.value = workspaceProjects[0]?.id ?? null
          }
        }
      }
    )

    initialized.value = true
  }

  function setCurrentWorkspaceId(id: number) {
    currentWorkspaceId.value = id
    // Reset project selection when workspace changes
    currentProjectId.value = null
  }

  function setCurrentProjectId(id: number | null) {
    currentProjectId.value = id
  }

  function ensureAccessibleWorkspace(availableIds: number[]) {
    if (
      currentWorkspaceId.value &&
      availableIds.includes(currentWorkspaceId.value)
    ) {
      return
    }

    // Find first accessible workspace
    const accessible = workspaces.value.find((w) => availableIds.includes(w.id))
    currentWorkspaceId.value = accessible?.id ?? availableIds[0] ?? null
  }

  return {
    // State
    currentWorkspaceId,
    currentProjectId,
    initialized,
    // Getters
    currentWorkspace,
    currentProject,
    availableProjects,
    // Actions
    init,
    setCurrentWorkspaceId,
    setCurrentProjectId,
    ensureAccessibleWorkspace,
  }
})
