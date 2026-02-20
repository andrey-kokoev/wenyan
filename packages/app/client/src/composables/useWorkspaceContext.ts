import { storeToRefs } from "pinia"
import { useWorkspaceContextStore } from "@/stores/workspaceContext"

export function useWorkspaceContext() {
  const store = useWorkspaceContextStore()
  store.init()

  const {
    currentWorkspaceId,
    currentProjectId,
    currentWorkspace,
    currentProject,
    availableProjects,
  } = storeToRefs(store)

  return {
    // State
    currentWorkspaceId,
    currentProjectId,
    currentWorkspace,
    currentProject,
    availableProjects,
    // Actions
    setCurrentWorkspaceId: store.setCurrentWorkspaceId,
    setCurrentProjectId: store.setCurrentProjectId,
    ensureAccessibleWorkspace: store.ensureAccessibleWorkspace,
  }
}
