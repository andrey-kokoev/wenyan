import { storeToRefs } from "pinia"
import { onMounted, watch } from "vue"
import { useAuthStore } from "@/auth"
import { useRuleSetsStore, type CreateRuleSetInput, type UpdateRuleSetInput } from "@/stores/ruleSets"

export function useRuleSets() {
  const store = useRuleSetsStore()
  const { ruleSets, loaded, loading, error } = storeToRefs(store)
  const auth = useAuthStore()

  async function fetchAll() {
    await store.fetchAll()
  }

  async function fetchIfEmpty() {
    await store.fetchIfEmpty()
  }

  async function create(input: CreateRuleSetInput) {
    return store.create(input)
  }

  async function patch(id: number, updates: UpdateRuleSetInput) {
    return store.patch(id, updates)
  }

  async function remove(id: number) {
    return store.remove(id)
  }

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
    data: ruleSets,
    loaded,
    loading,
    error,
    fetchAll,
    fetchIfEmpty,
    create,
    patch,
    remove,
    getById: store.getById,
  }
}
