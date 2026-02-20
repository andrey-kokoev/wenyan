import { storeToRefs } from "pinia"
import { onMounted, watch } from "vue"
import { useAuthStore } from "@/auth"
import { useRulesStore, type CreateRuleInput, type UpdateRuleInput } from "@/stores/rules"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

function buildUrl(path: string): string {
  if (API_URL === "/" || API_URL === "") {
    return path.startsWith("/") ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export function useRules() {
  const store = useRulesStore()
  const { rules, loaded, loading, error } = storeToRefs(store)
  const auth = useAuthStore()

  async function fetchAll() {
    await store.fetchAll()
  }

  async function fetchIfEmpty() {
    await store.fetchIfEmpty()
  }

  async function create(input: CreateRuleInput) {
    return store.create(input)
  }

  async function createWithAi(input: { prompt: string; referenceRuleIds?: number[] }) {
    return store.createWithAi(input)
  }

  async function checkDuplicates(input: { proposed: Array<{ code: string; name: string; description?: string }> }) {
    const storeAny = store as unknown as { checkDuplicates?: typeof store.checkDuplicates }
    if (typeof storeAny.checkDuplicates === "function") {
      return storeAny.checkDuplicates(input)
    }
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
  }

  async function patch(id: number, updates: UpdateRuleInput) {
    return store.patch(id, updates)
  }

  async function remove(id: number) {
    return store.remove(id)
  }

  async function fetchById(id: number) {
    return store.fetchById(id)
  }

  // Auto-fetch when authenticated
  if (import.meta.client) {
    onMounted(() => {
      watch(
        () => auth.isAuthenticated,
        async (isAuth) => {
          if (isAuth) {
            await fetchIfEmpty()
          }
        },
        { immediate: true }
      )
    })
  }

  return {
    // State
    data: rules,
    loaded,
    loading,
    error,
    // Actions
    fetchAll,
    fetchIfEmpty,
    fetchById,
    create,
    createWithAi,
    checkDuplicates,
    patch,
    remove,
    getById: store.getById,
  }
}
