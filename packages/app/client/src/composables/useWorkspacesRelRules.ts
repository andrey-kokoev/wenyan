import { storeToRefs } from "pinia"
import { computed, unref, type MaybeRef } from "vue"
import { useWorkspacesRelRulesStore } from "@/stores/workspacesRelRules"

export function useWorkspacesRelRules(workspaceId?: MaybeRef<number | undefined>) {
  const store = useWorkspacesRelRulesStore()
  const { workspaceRulesMap, loaded, loading, error } = storeToRefs(store)

  const workspaceIdValue = computed(() => unref(workspaceId))

  const workspaceMappings = computed(() => {
    if (workspaceIdValue.value === undefined) return []
    return store.getByWorkspaceId(workspaceIdValue.value)
  })

  const linkedRuleIds = computed(() => {
    if (workspaceIdValue.value === undefined) return []
    return store.getLinkedRuleIds(workspaceIdValue.value)
  })

  async function fetchByWorkspaceId(wid: number) {
    return store.fetchByWorkspaceId(wid)
  }

  async function linkRule(ruleId: number) {
    if (workspaceIdValue.value === undefined) {
      throw new Error("workspaceId is required to link rule")
    }
    return store.linkRule(workspaceIdValue.value, ruleId)
  }

  async function unlinkRule(ruleId: number) {
    if (workspaceIdValue.value === undefined) {
      throw new Error("workspaceId is required to unlink rule")
    }
    return store.unlinkRule(workspaceIdValue.value, ruleId)
  }

  function isRuleLinked(ruleId: number): boolean {
    if (workspaceIdValue.value === undefined) return false
    return store.isRuleLinked(workspaceIdValue.value, ruleId)
  }

  return {
    data: workspaceRulesMap,
    workspaceMappings,
    linkedRuleIds,
    loaded,
    loading,
    error,
    fetchByWorkspaceId,
    linkRule,
    unlinkRule,
    isRuleLinked,
  }
}
