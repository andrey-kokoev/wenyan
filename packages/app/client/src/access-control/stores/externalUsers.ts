import { ref } from "vue"
import { defineStore } from "pinia"
import { apiFetch } from "../../lib/api"
import type { ExternalUserIdRelRole } from "@wenyan/shared"

export type { ExternalUserIdRelRole }

export const useExternalUsersStore = defineStore("externalUsers", () => {
  const mappings = ref<ExternalUserIdRelRole[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787"

  function buildUrl(path: string): string {
    if (API_URL === "/" || API_URL === "") {
      return path.startsWith("/") ? path : `/${path}`
    }
    return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
  }

  async function fetchAll() {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      const result = await apiFetch<ExternalUserIdRelRole[]>(
        buildUrl("/api/access-control/external-user-ids-rel-roles")
      )
      mappings.value = result
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(mapping: { externalUserId: string; roleId: number }) {
    const result = await apiFetch<ExternalUserIdRelRole>(
      buildUrl("/api/access-control/external-user-ids-rel-roles"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapping),
      }
    )
    mappings.value.push(result)
    return result
  }

  async function remove(id: number) {
    await apiFetch(
      buildUrl(`/api/access-control/external-user-ids-rel-roles/${id}`),
      {
        method: "DELETE",
      }
    )
    mappings.value = mappings.value.filter((m: ExternalUserIdRelRole) => m.id !== id)
  }

  function getById(id: number): ExternalUserIdRelRole | undefined {
    return mappings.value.find((m: ExternalUserIdRelRole) => m.id === id)
  }

  return {
    mappings,
    loading,
    loaded,
    error,
    fetchAll,
    create,
    remove,
    getById,
  }
})
