import { storeToRefs } from "pinia"
import { useRolesRelControlledActionsStore } from "../stores/rolesRelControlledActions"

/**
 * Composable for accessing role-to-controlled-actions relationships.
 * Returns actionsByRole, mappings, and store actions for use in other composables/components.
 */
export function useRolesRelControlledActions() {
  const store = useRolesRelControlledActionsStore()
  const { actionsByRole, mappings, loading } = storeToRefs(store)

  return {
    actionsByRole,
    mappings,
    loading,
    fetchAll: store.fetchAll,
    create: store.create,
    remove: store.remove,
    getByRoleId: store.getByRoleId,
  }
}
