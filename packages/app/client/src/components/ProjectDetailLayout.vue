<template>
  <div class="container mx-auto py-8 px-4">
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="error" class="text-center py-12">
      <Icon icon="heroicons:exclamation-triangle" class="w-12 h-12 mx-auto text-destructive" />
      <p class="mt-4 text-destructive">{{ error }}</p>
      <Button variant="outline" class="mt-4" @click="emit('retry')">
        Retry
      </Button>
    </div>

    <div v-else-if="!project" class="text-center py-12">
      <Icon icon="heroicons:folder-open" class="w-12 h-12 mx-auto text-muted-foreground" />
      <p class="mt-4 text-muted-foreground">Project not found.</p>
      <Button class="mt-4" @click="emit('back')">
        Back to Workspace
      </Button>
    </div>

    <div v-else class="space-y-6">
      <div class="flex gap-0">
        <div class="flex-1 min-w-0 space-y-6">
          <Button variant="ghost" @click="emit('back')">
            <Icon icon="heroicons:arrow-left" class="w-4 h-4 mr-2" />
            Back to Workspace
          </Button>

          <ProjectCard>
            <slot name="tabs" />
          </ProjectCard>
        </div>

        <slot name="viewer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { Button } from "@/components/ui/button"
import ProjectCard from "@/components/ProjectCard.vue"

defineProps<{
  loading: boolean
  error: string | null
  project: any
}>()

const emit = defineEmits<{
  retry: []
  back: []
}>()
</script>
