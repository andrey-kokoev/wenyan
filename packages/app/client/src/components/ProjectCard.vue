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

const { currentProject, currentWorkspace } = useWorkspaceContext()

const projectInfo = computed(() => {
  if (!currentProject.value) return null
  return {
    name: currentProject.value.name,
    description: currentProject.value.description,
    workspaceName: currentWorkspace.value?.name,
    createdAt: new Date(currentProject.value.createdAt * 1000).toLocaleDateString(),
  }
})
</script>

<template>
  <Card class="h-full flex flex-col">
    <CardHeader class="pb-3">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <CardTitle class="text-lg flex items-center gap-2">
            <Icon icon="heroicons:folder" class="h-5 w-5 text-primary flex-shrink-0" />
            <span class="truncate">
              {{ projectInfo?.name ?? "No Project Selected" }}
            </span>
          </CardTitle>
          <CardDescription v-if="projectInfo?.description" class="mt-1 line-clamp-2">
            {{ projectInfo.description }}
          </CardDescription>
          <CardDescription v-else-if="projectInfo" class="mt-1">
            No description
          </CardDescription>
          <CardDescription v-else class="mt-1">
            Select or create a project to get started
          </CardDescription>
        </div>
      </div>

      <!-- Metadata row -->
      <div v-if="projectInfo" class="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <div class="flex items-center gap-1">
          <Icon icon="heroicons:briefcase" class="h-3.5 w-3.5" />
          <span class="truncate max-w-[150px]">{{ projectInfo.workspaceName }}</span>
        </div>
        <div class="flex items-center gap-1">
          <Icon icon="heroicons:calendar" class="h-3.5 w-3.5" />
          <span>Created {{ projectInfo.createdAt }}</span>
        </div>
      </div>
    </CardHeader>

    <CardContent class="flex-1 pt-0">
      <slot />
    </CardContent>
  </Card>
</template>
