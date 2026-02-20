import { storeToRefs } from "pinia"
import { computed } from "vue"
import { useRuleSetsRelRulesStore } from "@/stores/ruleSetsRelRules"

export function useRuleSetsRelRules(ruleSetId?: number) {
  const store = useRuleSetsRelRulesStore()
  const { ruleSetRulesMap, loaded, loading, error } = storeToRefs(store)

  const ruleSetMappings = computed(() => {
    if (ruleSetId === undefined) return []
    return store.getByRuleSetId(ruleSetId)
  })

  const linkedRuleIds = computed(() => {
    if (ruleSetId === undefined) return []
    return store.getLinkedRuleIds(ruleSetId)
  })

  async function fetchByRuleSetId(rid: number) {
    return store.fetchByRuleSetId(rid)
  }

  async function linkRule(ruleId: number) {
    if (ruleSetId === undefined) {
      throw new Error("ruleSetId is required to link rule")
    }
    return store.linkRule(ruleSetId, ruleId)
  }

  async function unlinkRule(ruleId: number) {
    if (ruleSetId === undefined) {
      throw new Error("ruleSetId is required to unlink rule")
    }
    return store.unlinkRule(ruleSetId, ruleId)
  }

  function isRuleLinked(ruleId: number): boolean {
    if (ruleSetId === undefined) return false
    return store.isRuleLinked(ruleSetId, ruleId)
  }

  return {
    data: ruleSetRulesMap,
    ruleSetMappings,
    linkedRuleIds,
    loaded,
    loading,
    error,
    fetchByRuleSetId,
    linkRule,
    unlinkRule,
    isRuleLinked,
  }
}
