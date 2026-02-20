<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue"
import { Icon } from "@iconify/vue"
import { useWorkspaces } from "@/composables/useWorkspaces"
import { useWorkspaceContext } from "@/composables/useWorkspaceContext"
import Button from "./ui/button/Button.vue"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

const props = defineProps<{
  collapsed?: boolean
}>()

const { data: workspaces, loading: workspacesLoading, fetchAll } = useWorkspaces()

const { currentWorkspaceId, setCurrentWorkspaceId, currentWorkspace } = useWorkspaceContext()
const isSelectDialogOpen = ref(false)

// Explicitly fetch workspaces on mount
onMounted(async () => {
  await fetchAll()
})

const workspaceOptions = computed(() => {
  return workspaces.value.map((w) => ({
    label: w.name,
    value: w.id,
  }))
})

const selectedWorkspace = computed({
  get: () => currentWorkspaceId.value?.toString() ?? "",
  set: (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      setCurrentWorkspaceId(num)
    }
  },
})

function setCurrentWorkspaceId_(id: number) {
  setCurrentWorkspaceId(id)
  isSelectDialogOpen.value = false
}

watch(
  () => workspaceOptions.value,
  (options) => {
    if (options.length > 0 && !currentWorkspaceId.value) {
      setCurrentWorkspaceId_(options[0].value)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="!collapsed" class="px-3 py-2">
    <div class="text-xs text-muted-foreground mb-1.5 font-medium">Workspace</div>

    <div class="flex gap-2 min-w-0">
      <Select v-model="selectedWorkspace" :disabled="workspacesLoading" class="flex-1 min-w-0">
        <SelectTrigger class="flex-1 h-8 text-sm min-w-0">
          <SelectValue :placeholder="workspacesLoading ? 'Loading...' : 'Select workspace'">
            {{ currentWorkspace?.name ?? "Select workspace" }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in workspaceOptions"
            :key="option.value"
            :value="option.value.toString()"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

    </div>
  </div>

  <!-- Collapsed mode - icon only with tooltip -->
  <div v-else class="flex justify-center py-2">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 p-0"
          @click="isSelectDialogOpen = true"
        >
          <Icon icon="heroicons:briefcase" class="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ currentWorkspace?.name ?? 'Select workspace' }}</TooltipContent>
    </Tooltip>
  </div>

  <Dialog v-model:open="isSelectDialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Select Workspace</DialogTitle>
      </DialogHeader>
      <div class="space-y-2 py-4">
        <Button
          v-for="option in workspaceOptions"
          :key="option.value"
          variant="ghost"
          class="w-full justify-start"
          :class="{ 'bg-accent': currentWorkspaceId === option.value }"
          @click="setCurrentWorkspaceId_(option.value)"
        >
          {{ option.label }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>

</template>
