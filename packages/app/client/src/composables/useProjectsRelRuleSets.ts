import { storeToRefs } from "pinia"
import { computed, unref, type MaybeRef } from "vue"
import { useProjectsRelRuleSetsStore } from "@/stores/projectsRelRuleSets"

export function useProjectsRelRuleSets(projectId?: MaybeRef<number | undefined>) {
  const store = useProjectsRelRuleSetsStore()
  const { projectRuleSetsMap, loaded, loading, error } = storeToRefs(store)
  const projectIdValue = computed(() => unref(projectId))

  const projectMappings = computed(() => {
    if (projectIdValue.value === undefined) return []
    return store.getByProjectId(projectIdValue.value)
  })

  const linkedRuleSetIds = computed(() => {
    if (projectIdValue.value === undefined) return []
    return store.getLinkedRuleSetIds(projectIdValue.value)
  })

  async function fetchByProjectId(pid: number) {
    return store.fetchByProjectId(pid)
  }

  async function linkRuleSet(ruleSetId: number) {
    if (projectIdValue.value === undefined) {
      throw new Error("projectId is required to link rule set")
    }
    return store.linkRuleSet(projectIdValue.value, ruleSetId)
  }

  async function unlinkRuleSet(ruleSetId: number) {
    if (projectIdValue.value === undefined) {
      throw new Error("projectId is required to unlink rule set")
    }
    return store.unlinkRuleSet(projectIdValue.value, ruleSetId)
  }

  function isRuleSetLinked(ruleSetId: number): boolean {
    if (projectIdValue.value === undefined) return false
    return store.isRuleSetLinked(projectIdValue.value, ruleSetId)
  }

  return {
    data: projectRuleSetsMap,
    projectMappings,
    linkedRuleSetIds,
    loaded,
    loading,
    error,
    fetchByProjectId,
    linkRuleSet,
    unlinkRuleSet,
    isRuleSetLinked,
  }
}
