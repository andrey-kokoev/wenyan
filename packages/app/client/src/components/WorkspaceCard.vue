<script setup lang="ts">
import { computed } from "vue"
import { Icon } from "@iconify/vue"
import { useWorkspaceContext } from "@/composables/useWorkspaceContext"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card"

const { currentWorkspace } = useWorkspaceContext()

const workspaceInfo = computed(() => {
  if (!currentWorkspace.value) return null
  return {
    name: currentWorkspace.value.name,
    isPersonal: currentWorkspace.value.isPersonal,
    createdAt: new Date(currentWorkspace.value.createdAt * 1000).toLocaleDateString(),
  }
})
</script>

<template>
  <Card class="h-full flex flex-col">
    <CardHeader class="pb-3">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <CardTitle class="text-lg flex items-center gap-2">
            <Icon icon="heroicons:briefcase" class="h-5 w-5 text-primary flex-shrink-0" />
            <span class="truncate">
              {{ workspaceInfo?.name ?? "No Workspace Selected" }}
            </span>
          </CardTitle>
          <CardDescription v-if="workspaceInfo" class="mt-1">
            {{ workspaceInfo.isPersonal ? "Personal workspace" : "Workspace" }}
          </CardDescription>
          <CardDescription v-else class="mt-1">
            Select or create a workspace to get started
          </CardDescription>
        </div>
      </div>

      <div v-if="workspaceInfo" class="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <div class="flex items-center gap-1">
          <Icon icon="heroicons:calendar" class="h-3.5 w-3.5" />
          <span>Created {{ workspaceInfo.createdAt }}</span>
        </div>
      </div>
    </CardHeader>

    <CardContent class="flex-1 pt-0">
      <slot />
    </CardContent>
  </Card>
</template>
