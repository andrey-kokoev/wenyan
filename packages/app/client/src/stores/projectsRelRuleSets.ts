import { ref } from "vue"
import { defineStore } from "pinia"
import type { RuleSet } from "@wenyan/shared"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

function buildUrl(path: string): string {
  if (API_URL === "/" || API_URL === "") {
    return path.startsWith("/") ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
}

type ProjectRuleSetsMap = Record<number, number[]>

export const useProjectsRelRuleSetsStore = defineStore("projectsRelRuleSets", () => {
  const projectRuleSetsMap = ref<ProjectRuleSetsMap>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref<Record<number, boolean>>({})

  function getLinkedRuleSetIds(projectId: number): number[] {
    return projectRuleSetsMap.value[projectId] || []
  }

  function isRuleSetLinked(projectId: number, ruleSetId: number): boolean {
    return getLinkedRuleSetIds(projectId).includes(ruleSetId)
  }

  function getByProjectId(projectId: number): { projectId: number; ruleSetId: number }[] {
    const ruleSetIds = getLinkedRuleSetIds(projectId)
    return ruleSetIds.map((ruleSetId) => ({ projectId, ruleSetId }))
  }

  async function fetchByProjectId(projectId: number): Promise<RuleSet[]> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/projects/${projectId}/rule-sets`),
        {
          credentials: "include",
        }
      )

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch project rule sets (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const ruleSets = data.data as RuleSet[]

      projectRuleSetsMap.value[projectId] = ruleSets.map((r) => r.id)
      loaded.value[projectId] = true

      return ruleSets
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function linkRuleSet(projectId: number, ruleSetId: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/projects/${projectId}/rule-sets`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ruleSetId }),
        }
      )

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to link rule set (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const current = projectRuleSetsMap.value[projectId] || []
      if (!current.includes(ruleSetId)) {
        projectRuleSetsMap.value[projectId] = [...current, ruleSetId]
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function unlinkRuleSet(projectId: number, ruleSetId: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(
        buildUrl(`/api/projects/${projectId}/rule-sets/${ruleSetId}`),
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
          `Failed to unlink rule set (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const current = projectRuleSetsMap.value[projectId] || []
      projectRuleSetsMap.value[projectId] = current.filter((id) => id !== ruleSetId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    projectRuleSetsMap,
    loading,
    error,
    loaded,
    getLinkedRuleSetIds,
    isRuleSetLinked,
    getByProjectId,
    fetchByProjectId,
    linkRuleSet,
    unlinkRuleSet,
  }
})
