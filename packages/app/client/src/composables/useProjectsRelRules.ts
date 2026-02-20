import { storeToRefs } from "pinia"
import { computed, unref, type MaybeRef } from "vue"
import { useProjectsRelRulesStore } from "@/stores/projectsRelRules"

export function useProjectsRelRules(projectId?: MaybeRef<number | undefined>) {
  const store = useProjectsRelRulesStore()
  const { projectRulesMap, loaded, loading, error } = storeToRefs(store)
  const projectIdValue = computed(() => unref(projectId))

  const projectMappings = computed(() => {
    if (projectIdValue.value === undefined) return []
    return store.getByProjectId(projectIdValue.value)
  })

  const linkedRuleIds = computed(() => {
    if (projectIdValue.value === undefined) return []
    return store.getLinkedRuleIds(projectIdValue.value)
  })

  async function fetchByProjectId(pid: number) {
    return store.fetchByProjectId(pid)
  }

  async function linkRule(ruleId: number) {
    if (projectIdValue.value === undefined) {
      throw new Error("projectId is required to link rule")
    }
    return store.linkRule(projectIdValue.value, ruleId)
  }

  async function unlinkRule(ruleId: number) {
    if (projectIdValue.value === undefined) {
      throw new Error("projectId is required to unlink rule")
    }
    return store.unlinkRule(projectIdValue.value, ruleId)
  }

  function isRuleLinked(ruleId: number): boolean {
    if (projectIdValue.value === undefined) return false
    return store.isRuleLinked(projectIdValue.value, ruleId)
  }

  return {
    // State
    data: projectRulesMap,
    projectMappings,
    linkedRuleIds,
    loaded,
    loading,
    error,
    // Actions
    fetchByProjectId,
    linkRule,
    unlinkRule,
    isRuleLinked,
  }
}
