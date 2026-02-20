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

type WorkspaceRulesMap = Record<number, number[]>

export const useWorkspacesRelRulesStore = defineStore("workspacesRelRules", () => {
  const workspaceRulesMap = ref<WorkspaceRulesMap>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref<Record<number, boolean>>({})

  function getLinkedRuleIds(workspaceId: number): number[] {
    return workspaceRulesMap.value[workspaceId] || []
  }

  function isRuleLinked(workspaceId: number, ruleId: number): boolean {
    return getLinkedRuleIds(workspaceId).includes(ruleId)
  }

  function getByWorkspaceId(workspaceId: number): { workspaceId: number; ruleId: number }[] {
    const ruleIds = getLinkedRuleIds(workspaceId)
    return ruleIds.map((ruleId) => ({ workspaceId, ruleId }))
  }

  async function fetchByWorkspaceId(workspaceId: number): Promise<Rule[]> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/workspaces/${workspaceId}/rules`),
        {
          credentials: "include",
        }
      )

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch workspace rules (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const rules = data.data as Rule[]

      workspaceRulesMap.value[workspaceId] = rules.map((r) => r.id)
      loaded.value[workspaceId] = true

      return rules
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function linkRule(workspaceId: number, ruleId: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/workspaces/${workspaceId}/rules`),
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

      const current = workspaceRulesMap.value[workspaceId] || []
      if (!current.includes(ruleId)) {
        workspaceRulesMap.value[workspaceId] = [...current, ruleId]
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function unlinkRule(workspaceId: number, ruleId: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/workspaces/${workspaceId}/rules/${ruleId}`),
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

      const current = workspaceRulesMap.value[workspaceId] || []
      workspaceRulesMap.value[workspaceId] = current.filter((id) => id !== ruleId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    workspaceRulesMap,
    loading,
    error,
    loaded,
    getLinkedRuleIds,
    isRuleLinked,
    getByWorkspaceId,
    fetchByWorkspaceId,
    linkRule,
    unlinkRule,
  }
})
