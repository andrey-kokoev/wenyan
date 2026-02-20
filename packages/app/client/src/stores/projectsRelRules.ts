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

// Store mapping of projectId -> ruleId[]
type ProjectRulesMap = Record<number, number[]>

export const useProjectsRelRulesStore = defineStore("projectsRelRules", () => {
  // State - stores which ruleIds are linked to each projectId
  const projectRulesMap = ref<ProjectRulesMap>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref<Record<number, boolean>>({})

  // Getters
  function getLinkedRuleIds(projectId: number): number[] {
    return projectRulesMap.value[projectId] || []
  }

  function isRuleLinked(projectId: number, ruleId: number): boolean {
    return getLinkedRuleIds(projectId).includes(ruleId)
  }

  function getByProjectId(projectId: number): { projectId: number; ruleId: number }[] {
    const ruleIds = getLinkedRuleIds(projectId)
    return ruleIds.map((ruleId) => ({ projectId, ruleId }))
  }

  // Actions
  async function fetchByProjectId(projectId: number): Promise<Rule[]> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/projects/${projectId}/rules`),
        {
          credentials: "include",
        }
      )

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch project rules (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const rules = data.data as Rule[]

      // Store the rule IDs for this project
      projectRulesMap.value[projectId] = rules.map((r) => r.id)
      loaded.value[projectId] = true

      return rules
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function linkRule(projectId: number, ruleId: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/projects/${projectId}/rules`),
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

      // Add to local state
      const current = projectRulesMap.value[projectId] || []
      if (!current.includes(ruleId)) {
        projectRulesMap.value[projectId] = [...current, ruleId]
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function unlinkRule(projectId: number, ruleId: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/projects/${projectId}/rules/${ruleId}`),
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

      // Remove from local state
      const current = projectRulesMap.value[projectId] || []
      projectRulesMap.value[projectId] = current.filter((id) => id !== ruleId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    projectRulesMap,
    loading,
    error,
    loaded,
    // Getters
    getLinkedRuleIds,
    isRuleLinked,
    getByProjectId,
    // Actions
    fetchByProjectId,
    linkRule,
    unlinkRule,
  }
})
