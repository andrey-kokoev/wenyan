import { ref } from "vue"
import { defineStore } from "pinia"
import { apiFetch } from "../../lib/api"
import type { Role } from "@wenyan/shared"

export type { Role }

export const useRolesStore = defineStore("roles", () => {
  const roles = ref<Role[]>([])
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
      const result = await apiFetch<Role[]>(
        buildUrl("/api/access-control/roles")
      )
      roles.value = result
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(role: { name: string; description?: string }) {
    const result = await apiFetch<Role>(buildUrl("/api/access-control/roles"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(role),
    })
    roles.value.push(result)
    return result
  }

  async function update(id: number, data: Partial<Role>) {
    const result = await apiFetch<Role>(
      buildUrl(`/api/access-control/roles/${id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    )
    const idx = roles.value.findIndex((r: Role) => r.id === id)
    if (idx !== -1) {
      roles.value[idx] = result
    }
    return result
  }

  async function remove(id: number) {
    await apiFetch(buildUrl(`/api/access-control/roles/${id}`), {
      method: "DELETE",
    })
    roles.value = roles.value.filter((r: Role) => r.id !== id)
  }

  function getById(id: number): Role | undefined {
    return roles.value.find((r: Role) => r.id === id)
  }

  function getNameById(id: number): string | undefined {
    return getById(id)?.name
  }

  return {
    roles,
    loading,
    loaded,
    error,
    fetchAll,
    create,
    update,
    remove,
    getById,
    getNameById,
  }
})
