import { ref, computed } from "vue"
import { defineStore } from "pinia"
import { apiFetch } from "../../lib/api"
import type {
  RoleRelControlledAction,
  ControlledActionCode,
} from "@wenyan/shared"
import { useControlledActionsStore } from "./controlledActions"

export type { RoleRelControlledAction }

export const useRolesRelControlledActionsStore = defineStore(
  "rolesRelControlledActions",
  () => {
    const mappings = ref<RoleRelControlledAction[]>([])
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

    // Computed: Get action codes by role ID
    const actionsByRole = computed<Record<number, ControlledActionCode[]>>(
      () => {
        const caStore = useControlledActionsStore()
        const map: Record<number, ControlledActionCode[]> = {}

        for (const rel of mappings.value) {
          const action = caStore.controlledActions.find(
            (a: { id: number }) => a.id === rel.controlledActionId
          )
          if (action) {
            if (!map[rel.roleId]) {
              map[rel.roleId] = []
            }
            map[rel.roleId]!.push(action.code as ControlledActionCode)
          }
        }
        return map
      }
    )

    async function fetchAll() {
      if (loading.value) return
      loading.value = true
      error.value = null
      try {
        const result = await apiFetch<RoleRelControlledAction[]>(
          buildUrl("/api/access-control/roles-rel-controlled-actions")
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

    async function create(mapping: {
      roleId: number
      controlledActionId: number
    }) {
      const result = await apiFetch<RoleRelControlledAction>(
        buildUrl("/api/access-control/roles-rel-controlled-actions"),
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
        buildUrl(`/api/access-control/roles-rel-controlled-actions/${id}`),
        {
          method: "DELETE",
        }
      )
      mappings.value = mappings.value.filter((m: RoleRelControlledAction) => m.id !== id)
    }

    // Get all mappings for a specific role
    function getByRoleId(roleId: number): RoleRelControlledAction[] {
      return mappings.value.filter((m: RoleRelControlledAction) => m.roleId === roleId)
    }

    return {
      mappings,
      loading,
      loaded,
      error,
      actionsByRole,
      fetchAll,
      create,
      remove,
      getByRoleId,
    }
  }
)
