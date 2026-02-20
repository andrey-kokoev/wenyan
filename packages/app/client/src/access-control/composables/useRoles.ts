// Standard composable for roles
// Provides access to roles store and helpers
import { storeToRefs } from "pinia"
import { useRolesStore, type Role } from "../stores/roles"

export function useRoles() {
  const rolesStore = useRolesStore()
  const { roles, loaded, loading, error } = storeToRefs(rolesStore)

  function getRoleById(id: number): Role | undefined {
    return rolesStore.getById(id)
  }

  function getNameById(id: number): string | undefined {
    return rolesStore.getNameById(id)
  }

  async function fetchAllRoles() {
    await rolesStore.fetchAll()
  }

  async function fetchIfEmpty() {
    if (!loaded.value && !loading.value) {
      await fetchAllRoles()
    }
  }

  async function createRole(role: { name: string; description?: string }) {
    await rolesStore.create(role)
  }

  async function updateRole(id: number, data: Partial<Role>) {
    await rolesStore.update(id, data)
  }

  async function deleteRole(id: number) {
    await rolesStore.remove(id)
  }

  return {
    roles,
    loaded,
    loading,
    error,
    fetchAllRoles,
    fetchIfEmpty,
    createRole,
    updateRole,
    deleteRole,
    getRoleById,
    getNameById,
  }
}
