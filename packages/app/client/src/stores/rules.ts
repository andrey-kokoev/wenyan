import { ref } from "vue"
import { defineStore } from "pinia"
import type { Rule } from "@wenyan/shared"
import type { CreateRuleInput, UpdateRuleInput } from "@wenyan/shared"

export type { Rule, CreateRuleInput, UpdateRuleInput }

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

function buildUrl(path: string): string {
  if (API_URL === "/" || API_URL === "") {
    return path.startsWith("/") ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export const useRulesStore = defineStore("rules", () => {
  // State
  const rules = ref<Rule[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // Getters
  function getById(id: number): Rule | undefined {
    return rules.value.find((r) => r.id === id)
  }

  // Actions
  async function fetchAll() {
    loading.value = true
    error.value = null

    try {
      const url = buildUrl("/api/rules")

      const response = await fetch(url, {
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 401) {
          rules.value = []
          loaded.value = true
          return
        }
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch rules (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      
      rules.value = data.data || []
      
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
    } finally {
      loading.value = false
    }
  }

  async function fetchIfEmpty() {
    if (!loaded.value && rules.value.length === 0) {
      await fetchAll()
    }
  }

  async function fetchById(id: number): Promise<Rule> {
    const existing = getById(id)
    if (existing) {
      return existing
    }

    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/rules/${id}`), {
        credentials: "include",
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Rule not found")
        }
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch rule (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const rule = data.data as Rule

      if (!getById(rule.id)) {
        rules.value.push(rule)
      }

      return rule
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(input: CreateRuleInput): Promise<Rule> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl("/api/rules"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to create rule (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const rule = data.data as Rule
      rules.value.push(rule)
      return rule
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createWithAi(input: {
    prompt: string
    referenceRuleIds?: number[]
  }): Promise<Array<Pick<Rule, "code" | "name" | "description">>> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl("/api/rules/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to create rule with AI (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const created = (data?.data?.rules || []) as Array<Pick<Rule, "code" | "name" | "description">>
      return created
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function checkDuplicates(input: {
    proposed: Array<Pick<Rule, "code" | "name" | "description">>
  }): Promise<
    Array<{
      proposedIndex: number
      matches: Array<{ id: number; code: string; name: string; description: string | null; similarity: number; reason?: string }>
    }>
  > {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl("/api/rules/ai/duplicates"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to check duplicates (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      return (data?.data?.duplicates || []) as Array<{
        proposedIndex: number
        matches: Array<{ id: number; code: string; name: string; description: string | null; similarity: number; reason?: string }>
      }>
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function patch(id: number, updates: UpdateRuleInput): Promise<Rule> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/rules/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to update rule (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const updated = data.data as Rule

      const index = rules.value.findIndex((r) => r.id === id)
      if (index !== -1) {
        rules.value[index] = updated
      }

      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function remove(id: number): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/rules/${id}`), {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to delete rule (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      rules.value = rules.value.filter((r) => r.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    rules,
    loading,
    error,
    loaded,
    // Getters
    getById,
    // Actions
    fetchAll,
    fetchIfEmpty,
    fetchById,
    create,
    createWithAi,
    checkDuplicates,
    patch,
    remove,
  }
})
