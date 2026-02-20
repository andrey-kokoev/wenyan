import { ref } from "vue"
import { defineStore } from "pinia"
import type { RuleSet, CreateRuleSetInput, UpdateRuleSetInput } from "@wenyan/shared"

export type { CreateRuleSetInput, UpdateRuleSetInput }

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

function buildUrl(path: string): string {
  if (API_URL === "/" || API_URL === "") {
    return path.startsWith("/") ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export const useRuleSetsStore = defineStore("ruleSets", () => {
  const ruleSets = ref<RuleSet[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  function getById(id: number): RuleSet | undefined {
    return ruleSets.value.find((set) => set.id === id)
  }

  async function fetchAll() {
    loading.value = true
    error.value = null

    try {
      const url = buildUrl("/api/rule-sets")

      const response = await fetch(url, { credentials: "include" })

      if (!response.ok) {
        if (response.status === 401) {
          ruleSets.value = []
          loaded.value = true
          return
        }
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to fetch rule sets (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      ruleSets.value = data.data || []
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
    } finally {
      loading.value = false
    }
  }

  async function fetchIfEmpty() {
    if (!loaded.value && ruleSets.value.length === 0) {
      await fetchAll()
    }
  }

  async function create(input: CreateRuleSetInput): Promise<RuleSet> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl("/api/rule-sets"), {
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
          `Failed to create rule set (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const created = data.data as RuleSet
      ruleSets.value.push(created)
      return created
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function patch(id: number, updates: UpdateRuleSetInput): Promise<RuleSet> {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(buildUrl(`/api/rule-sets/${id}`), {
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
          `Failed to update rule set (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      const data = (await response.json()) as any
      const updated = data.data as RuleSet

      const index = ruleSets.value.findIndex((set) => set.id === id)
      if (index !== -1) {
        ruleSets.value[index] = updated
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
      const response = await fetch(buildUrl(`/api/rule-sets/${id}`), {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as any
        const errorMessage =
          errorData?.error?.message ||
          errorData?.error ||
          `Failed to delete rule set (HTTP ${response.status})`
        throw new Error(errorMessage)
      }

      ruleSets.value = ruleSets.value.filter((set) => set.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    ruleSets,
    loading,
    error,
    loaded,
    getById,
    fetchAll,
    fetchIfEmpty,
    create,
    patch,
    remove,
  }
})
