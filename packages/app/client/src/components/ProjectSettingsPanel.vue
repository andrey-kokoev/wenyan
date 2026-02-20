<template>
  <Card class="border-0 shadow-none">
    <CardHeader>
      <CardTitle>Project Settings</CardTitle>
      <CardDescription>
        Manage project details and configuration.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="project-name">Project Name</Label>
        <Input id="project-name" v-model="localProject.name" />
      </div>
      <div class="space-y-2">
        <Label for="project-description">Description</Label>
        <Textarea id="project-description" v-model="localProject.description" rows="3" />
      </div>
    </CardContent>
    <CardFooter class="flex justify-between">
      <Button variant="solid" color="error" @click="emit('delete')">
        Delete Project
      </Button>
      <Button @click="emit('save')" :disabled="!hasChanges">
        Save Changes
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const props = defineProps<{
  editProject: { name: string; description: string }
  hasChanges: boolean
}>()

const emit = defineEmits<{
  "update:editProject": [{ name: string; description: string }]
  save: []
  delete: []
}>()

const localProject = reactive({
  name: props.editProject.name,
  description: props.editProject.description,
})

watch(
  () => props.editProject,
  (value) => {
    localProject.name = value.name
    localProject.description = value.description
  },
  { deep: true },
)

watch(
  () => localProject,
  (value) => {
    emit("update:editProject", { name: value.name, description: value.description })
  },
  { deep: true },
)
</script>
