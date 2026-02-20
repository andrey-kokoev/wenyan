<template>
  <div class="p-4">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium">
          Allowed Actions for <span class="font-mono">{{ role.name }}</span>
        </h4>
        <Button
          v-if="hasChanges"
          size="sm"
          :disabled="saving"
          @click="saveChanges"
        >
          <Loader2 v-if="saving" class="w-4 h-4 mr-2 animate-spin" />
          Save Changes
        </Button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="action in controlledActions"
          :key="action.id"
          class="flex items-start space-x-3 p-2 rounded hover:bg-muted/50"
        >
          <Checkbox
            :id="`action-${role.id}-${action.id}`"
            :model-value="selectedActions.includes(normalizeId(action.id))"
            :disabled="
              isProtected(roleId) && originalSelected.includes(normalizeId(action.id))
            "
            @update:modelValue="(checked: boolean | 'indeterminate') => toggleAction(normalizeId(action.id), checked === true)"
          />
          <div class="space-y-1">
            <Label
              :for="`action-${role.id}-${action.id}`"
              class="text-sm font-mono cursor-pointer"
            >
              {{ action.code }}
            </Label>
            <p class="text-xs text-muted-foreground">{{ action.name }}</p>
          </div>
        </div>
      </div>

      <div v-if="controlledActions.length === 0" class="text-sm text-muted-foreground">
        No controlled actions available.
      </div>

      <div v-if="showLoadError" class="text-sm text-destructive">
        Failed to load permissions. Please refresh and try again.
      </div>
      
      <div v-if="isProtected(roleId)" class="text-xs text-muted-foreground italic">
        Core permissions cannot be removed, but you can add additional permissions.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue"
import { storeToRefs } from "pinia"
import { Loader2 } from "lucide-vue-next"
import { useControlledActionsStore } from "../stores/controlledActions"
import { useRolesRelControlledActionsStore } from "../stores/rolesRelControlledActions"
import { useToast } from "@/composables/useToast"
import { isProtectedRole } from "@wenyan/shared"
import type { Role } from "../stores/roles"
import type { RoleRelControlledAction } from "../stores/rolesRelControlledActions"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface Props {
  role: Role
}

const props = defineProps<Props>()

const emit = defineEmits<{
  saved: []
}>()

const controlledActionsStore = useControlledActionsStore()
const {
  controlledActions,
  error: controlledActionsError,
  loaded: controlledActionsLoaded,
} = storeToRefs(controlledActionsStore)

const mappingsStore = useRolesRelControlledActionsStore()
const { mappings, error: mappingsError, loaded: mappingsLoaded } = storeToRefs(mappingsStore)

const { success, error: showError } = useToast()

function normalizeId(id: number | string): number {
  return Number(id)
}

// Helper function for template
function isProtected(id: number | string): boolean {
  return isProtectedRole(normalizeId(id))
}

// State
const selectedActions = ref<number[]>([])
const originalSelected = ref<number[]>([])
const saving = ref(false)
const roleId = computed(() => normalizeId(props.role.id))

// Computed
const hasChanges = computed(() => {
  if (selectedActions.value.length !== originalSelected.value.length) return true
  const originalSet = new Set(originalSelected.value)
  return selectedActions.value.some((id) => !originalSet.has(id))
})

const showLoadError = computed(() =>
  Boolean(controlledActionsError.value || mappingsError.value),
)

// Initialize selected actions based on existing mappings
function loadSelectedActions() {
  const currentRoleId = roleId.value
  const mappedActions = mappings.value
    .filter(
      (rel: RoleRelControlledAction) =>
        normalizeId(rel.roleId) === currentRoleId
    )
    .map((rel: RoleRelControlledAction) => normalizeId(rel.controlledActionId))

  selectedActions.value = [...mappedActions]
  originalSelected.value = [...mappedActions]
}

// Toggle individual action
function toggleAction(actionId: number, checked: boolean) {
  const currentRoleId = roleId.value
  // For protected roles, can't uncheck original/core permissions
  // But can check (add) new permissions
  if (
    !checked &&
    isProtectedRole(currentRoleId) &&
    originalSelected.value.includes(actionId)
  ) {
    return // Can't remove core permissions from protected roles
  }
  
  if (checked) {
    if (!selectedActions.value.includes(actionId)) {
      selectedActions.value = [...selectedActions.value, actionId]
    }
  } else {
    selectedActions.value = selectedActions.value.filter((id) => id !== actionId)
  }
}

// Save changes
async function saveChanges() {
  saving.value = true
  try {
    const currentRoleId = roleId.value
    const currentMappings = mappings.value.filter(
      (rel: RoleRelControlledAction) =>
        normalizeId(rel.roleId) === currentRoleId
    )

    // Find actions to add (selected but not currently mapped)
    const actionsToAdd: number[] = []
    for (const actionId of selectedActions.value) {
      if (
        !currentMappings.some(
          (m: RoleRelControlledAction) =>
            normalizeId(m.controlledActionId) === actionId
        )
      ) {
        actionsToAdd.push(actionId)
      }
    }

    // Find mappings to remove (currently mapped but not selected)
    // For protected roles, don't remove core permissions (originalSelected)
    const mappingsToRemove = currentMappings.filter((m: RoleRelControlledAction) => {
      const controlledActionId = normalizeId(m.controlledActionId)
      const isSelected = selectedActions.value.includes(controlledActionId)
      const isCorePermission =
        isProtectedRole(currentRoleId) &&
        originalSelected.value.includes(controlledActionId)
      return !isSelected && !isCorePermission
    })

    // Add new mappings
    const addResults = await Promise.allSettled(
      actionsToAdd.map((controlledActionId) =>
        mappingsStore.create({
          roleId: currentRoleId,
          controlledActionId,
        })
      )
    )

    // Remove old mappings (except core permissions for protected roles)
    const removeResults = await Promise.allSettled(
      mappingsToRemove.map((m: RoleRelControlledAction) => mappingsStore.remove(m.id))
    )

    const addFailures = addResults.filter((r) => r.status === "rejected")
    const removeFailures = removeResults.filter((r) => r.status === "rejected")
    if (addFailures.length > 0 || removeFailures.length > 0) {
      throw new Error("Failed to update one or more permissions")
    }

    // Refresh data and reset state
    await mappingsStore.fetchAll()
    loadSelectedActions()
    
    success("Role permissions updated")
    emit("saved")
  } catch (e) {
    showError("Failed to save changes", e instanceof Error ? e.message : "Unknown error")
  } finally {
    saving.value = false
  }
}

// Watch for changes in mappings
watch(() => mappings.value, loadSelectedActions, { deep: true })

// Load data on mount
onMounted(async () => {
  // Fetch controlled actions if not loaded
  if (!controlledActionsLoaded.value) {
    await controlledActionsStore.fetchAll()
  }
  // Fetch mappings if not loaded
  if (!mappingsLoaded.value) {
    await mappingsStore.fetchAll()
  }
  // Now load selected actions from the fetched data
  loadSelectedActions()

})
</script>
