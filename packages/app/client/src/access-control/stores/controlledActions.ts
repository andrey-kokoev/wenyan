import { ref } from "vue"
import { defineStore } from "pinia"
import { apiFetch } from "../../lib/api"
import type { ControlledAction } from "@wenyan/shared"

export type { ControlledAction }

export const useControlledActionsStore = defineStore("controlledActions", () => {
  const controlledActions = ref<ControlledAction[]>([])
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
      const result = await apiFetch<ControlledAction[]>(
        buildUrl("/api/access-control/controlled-actions")
      )
      controlledActions.value = result
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(action: {
    code: string
    name: string
    description?: string
  }) {
    const result = await apiFetch<ControlledAction>(
      buildUrl("/api/access-control/controlled-actions"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      }
    )
    controlledActions.value.push(result)
    return result
  }

  async function update(
    id: number,
    data: { name?: string; description?: string }
  ) {
    const result = await apiFetch<ControlledAction>(
      buildUrl(`/api/access-control/controlled-actions/${id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    )
    const idx = controlledActions.value.findIndex((a: ControlledAction) => a.id === id)
    if (idx !== -1) {
      controlledActions.value[idx] = result
    }
    return result
  }

  async function remove(id: number) {
    await apiFetch(buildUrl(`/api/access-control/controlled-actions/${id}`), {
      method: "DELETE",
    })
    controlledActions.value = controlledActions.value.filter((a: ControlledAction) => a.id !== id)
  }

  function getById(id: number): ControlledAction | undefined {
    return controlledActions.value.find((a: ControlledAction) => a.id === id)
  }

  function getByCode(code: string): ControlledAction | undefined {
    return controlledActions.value.find((a: ControlledAction) => a.code === code)
  }

  return {
    controlledActions,
    loading,
    loaded,
    error,
    fetchAll,
    create,
    update,
    remove,
    getById,
    getByCode,
  }
})
