<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import { useProjects } from "@/composables/useProjects"
import { useWorkspaceContext } from "@/composables/useWorkspaceContext"
import Button from "./ui/button/Button.vue"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { useToast } from "@/composables/useToast"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

const { currentWorkspaceProjects: projects, loading: projectsLoading } = useProjects()
const { currentProjectId, setCurrentProjectId, currentProject, currentWorkspace } =
  useWorkspaceContext()
const { create } = useProjects()
const { error: showError, success: showSuccess } = useToast()

const isCreateDialogOpen = ref(false)
const newProjectName = ref("")
const newProjectDescription = ref("")

const projectOptions = computed(() => {
  return projects.value.map((p) => {
    return {
      label: p.name,
      value: p.id,
    }
  })
})

const selectedProject = computed({
  get: () => currentProjectId.value?.toString() ?? "",
  set: (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      setCurrentProjectId(num)
    }
  },
})

async function handleCreateProject() {
  if (!newProjectName.value.trim()) {
    showError("Project name is required", "Please enter a name for your project.")
    return
  }

  if (!currentWorkspace.value) {
    showError("No workspace selected", "Please select a workspace first.")
    return
  }

  try {
    const project = await create({
      name: newProjectName.value.trim(),
      description: newProjectDescription.value.trim() || undefined,
      workspaceId: currentWorkspace.value.id,
    })
    setCurrentProjectId(project.id)
    newProjectName.value = ""
    newProjectDescription.value = ""
    isCreateDialogOpen.value = false
    showSuccess("Project created", `"${project.name}" has been created successfully.`)
  } catch (e) {
    console.error("Failed to create project:", e)
    const message = e instanceof Error ? e.message : "An unexpected error occurred"
    const code = (e as any).code

    if (code === "VALIDATION_ERROR") {
      showError("Invalid Project Data", message)
    } else if (code === "FORBIDDEN") {
      showError("Access Denied", "You do not have permission to create projects in this workspace.")
    } else {
      showError("Failed to Create Project", message)
    }
  }
}

// Auto-select first project if none selected
watch(
  () => projects.value,
  (ps) => {
    if (ps.length > 0 && !currentProjectId.value) {
      setCurrentProjectId(ps[0].id)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="text-sm text-muted-foreground whitespace-nowrap">Project:</div>

    <Select v-model="selectedProject" :disabled="projectsLoading">
      <SelectTrigger class="w-50 h-8 text-sm">
        <SelectValue :placeholder="projectsLoading ? 'Loading...' : 'Select project'">
          {{ currentProject?.name ?? "Select project" }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in projectOptions"
          :key="option.value"
          :value="option.value.toString()"
        >
          {{ option.label }}
        </SelectItem>
        <div v-if="projectOptions.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
          No projects yet
        </div>
      </SelectContent>
    </Select>

    <Dialog v-model:open="isCreateDialogOpen">
      <DialogTrigger as-child>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="sm" class="h-8 w-8 p-0">
              <Icon icon="heroicons:plus" class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create new project</TooltipContent>
        </Tooltip>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="project-name">Name</Label>
            <Input
              id="project-name"
              v-model="newProjectName"
              placeholder="My Project"
              @keyup.enter="handleCreateProject"
            />
          </div>
          <div class="space-y-2">
            <Label for="project-description">Description (optional)</Label>
            <Textarea
              id="project-description"
              v-model="newProjectDescription"
              placeholder="Project description..."
              rows="3"
            />
          </div>
          <Button class="w-full" @click="handleCreateProject" :disabled="!currentWorkspace">
            Create Project
          </Button>
          <p v-if="!currentWorkspace" class="text-xs text-muted-foreground text-center">
            Please select a workspace first
          </p>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
