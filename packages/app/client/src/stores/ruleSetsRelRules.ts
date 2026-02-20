import { ref } from "vue"
import { defineStore } from "pinia"
import type { Rule } from "@wenyan/shared"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

function buildUrl(path: string): string {
  if (API_URL === "/" || API_URL === "") {
    return path.startsWith("/") ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
}

type RuleSetRulesMap = Record<number, number[]>

export const useRuleSetsRelRulesStore = defineStore("ruleSetsRelRules", () => {
  const ruleSetRulesMap = ref<RuleSetRulesMap>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref<Record<number, boolean>>({})

  function getLinkedRuleIds(ruleSetId: number): number[] {
    return ruleSetRulesMap.value[ruleSetId] || []
  }

  function isRuleLinked(ruleSetId: number, ruleId: number): boolean {
    return getLinkedRuleIds(ruleSetId).includes(ruleId)
  }

  function getByRuleSetId(ruleSetId: number): { ruleSetId: number; ruleId: number }[] {
    const ruleIds = getLinkedRuleIds(ruleSetId)
    return ruleIds.map((ruleId) => ({ ruleSetId, ruleId }))
  }

  async function fetchByRuleSetId(ruleSetId: number): Promise<Rule[]> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/rule-sets/${ruleSetId}/rules`),
        {
          credentials: "include",
        }
      )

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch rule set rules (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const rules = data.data as Rule[]

      ruleSetRulesMap.value[ruleSetId] = rules.map((r) => r.id)
      loaded.value[ruleSetId] = true

      return rules
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function linkRule(ruleSetId: number, ruleId: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/rule-sets/${ruleSetId}/rules`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ruleId }),
        }
      )

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to link rule (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const current = ruleSetRulesMap.value[ruleSetId] || []
      if (!current.includes(ruleId)) {
        ruleSetRulesMap.value[ruleSetId] = [...current, ruleId]
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function unlinkRule(ruleSetId: number, ruleId: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/rule-sets/${ruleSetId}/rules/${ruleId}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      )

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to unlink rule (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const current = ruleSetRulesMap.value[ruleSetId] || []
      ruleSetRulesMap.value[ruleSetId] = current.filter((id) => id !== ruleId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    ruleSetRulesMap,
    loading,
    error,
    loaded,
    getLinkedRuleIds,
    isRuleLinked,
    getByRuleSetId,
    fetchByRuleSetId,
    linkRule,
    unlinkRule,
  }
})
