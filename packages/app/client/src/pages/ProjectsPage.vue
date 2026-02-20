<template>
  <div class="container mx-auto py-8 px-4">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Projects</h1>
          <p class="text-muted-foreground">
            Manage your projects across all workspaces.
          </p>
        </div>
        <Button @click="showCreateDialog = true">
          <Icon icon="heroicons:plus" class="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <!-- Projects Table -->
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>
            Click on a project to view details, or use the actions menu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="showSearch" class="mb-4 max-w-md">
            <Input v-model="searchQuery" placeholder="Search projects..." />
          </div>
          <div v-if="loading" class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
          
          <div v-else-if="error" class="text-center py-8">
            <p class="text-destructive">{{ error }}</p>
            <Button variant="outline" class="mt-4" @click="fetchAll">
              Retry
            </Button>
          </div>

          <div v-else-if="projectsWithWorkspaces.length === 0" class="text-center py-8">
            <Icon icon="heroicons:folder-open" class="w-12 h-12 mx-auto text-muted-foreground" />
            <p class="mt-4 text-muted-foreground">No projects yet.</p>
            <p class="text-sm text-muted-foreground">Create your first project to get started.</p>
          </div>

          <div v-else-if="filteredProjects.length === 0" class="text-center py-8 border rounded-lg">
            <Icon icon="heroicons:magnifying-glass" class="w-12 h-12 mx-auto text-muted-foreground" />
            <p class="mt-4 text-muted-foreground">No projects match your search.</p>
            <p class="text-sm text-muted-foreground">Try a different keyword.</p>
          </div>

          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead class="min-w-[20ch]">Name</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead class="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="project in filteredProjects"
                :key="project.id"
                class="cursor-pointer hover:bg-muted/50"
                @click="goToProject(project)"
              >
                <TableCell class="group font-medium">
                  <div class="flex items-center gap-2 min-w-0">
                    <Icon icon="heroicons:folder" class="w-4 h-4 text-primary" />
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                      <div v-if="editingProjectId === project.id" class="flex flex-1 items-center gap-1">
                        <Input
                          v-model="editingProjectName"
                          class="h-8 flex-1"
                          @click.stop
                          @keyup.enter="saveProjectName(project)"
                          @keyup.esc="cancelProjectEdit"
                        />
                        <Button
                          size="sm"
                          variant="link"
                          class="h-7 w-7 p-0"
                          :disabled="editSubmitting"
                          @click.stop="saveProjectName(project)"
                        >
                          <Icon icon="heroicons:check" class="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="link"
                          class="h-7 w-7 p-0 text-muted-foreground"
                          :disabled="editSubmitting"
                          @click.stop="cancelProjectEdit"
                        >
                          <Icon icon="heroicons:x-mark" class="h-4 w-4" />
                        </Button>
                      </div>
                      <div v-else class="flex min-w-0 flex-1 items-center gap-2">
                        <span class="truncate">{{ project.name }}</span>
                        <Button
                          variant="link"
                          size="sm"
                          class="ml-auto h-7 w-7 p-0 opacity-0 transition group-hover:opacity-100"
                          @click.stop="startProjectEdit(project)"
                        >
                          <Icon icon="heroicons:pencil-square" class="h-4 w-4" />
                          <span class="sr-only">Edit name</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell class="min-w-[15ch]">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <span class="block max-w-[15ch] truncate whitespace-nowrap">
                        {{ project.workspaceName }}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{{ project.workspaceName }}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell class="group max-w-xs">
                  <div class="flex min-w-0 items-center gap-2">
                    <div v-if="editingProjectId === project.id && editingField === 'description'" class="flex flex-1 items-center gap-1">
                      <Input
                        v-model="editingProjectDescription"
                        class="h-8 flex-1"
                        @click.stop
                        @keyup.enter="saveProjectDescription(project)"
                        @keyup.esc="cancelProjectEdit"
                      />
                      <Button
                        size="sm"
                        variant="link"
                        class="h-7 w-7 p-0"
                        :disabled="editSubmitting"
                        @click.stop="saveProjectDescription(project)"
                      >
                        <Icon icon="heroicons:check" class="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        class="h-7 w-7 p-0 text-muted-foreground"
                        :disabled="editSubmitting"
                        @click.stop="cancelProjectEdit"
                      >
                        <Icon icon="heroicons:x-mark" class="h-4 w-4" />
                      </Button>
                    </div>
                    <div v-else class="flex min-w-0 flex-1 items-center gap-2">
                      <span class="truncate">
                        {{ project.description || "No description" }}
                      </span>
                      <Button
                        variant="link"
                        size="sm"
                        class="ml-auto h-7 w-7 p-0 opacity-0 transition group-hover:opacity-100"
                        @click.stop="startProjectDescriptionEdit(project)"
                      >
                        <Icon icon="heroicons:pencil-square" class="h-4 w-4" />
                        <span class="sr-only">Edit description</span>
                      </Button>
                    </div>
                  </div>
                </TableCell>
                <TableCell class="text-xs text-muted-foreground">{{ formatDate(project.createdAt) }}</TableCell>
                <TableCell class="text-right">
                  <div class="flex items-center justify-end gap-3 text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <div class="inline-flex items-center gap-1">
                          <Icon icon="heroicons:document-text" class="h-4 w-4" />
                          <span>{{ project.documentsCount ?? 0 }}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Documents</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <div class="inline-flex items-center gap-1">
                          <Icon icon="heroicons:clipboard-document-check" class="h-4 w-4" />
                          <span>{{ project.rulesCount ?? 0 }}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Rules</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <div class="inline-flex items-center gap-1">
                          <Icon icon="heroicons:exclamation-triangle" class="h-4 w-4" />
                          <span>{{ project.issuesCount ?? 0 }}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Issues</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <!-- Create Project Dialog -->
    <Dialog v-model:open="showCreateDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a new project in the selected workspace.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="workspace">Workspace</Label>
            <Select v-model="newProject.workspaceId">
              <SelectTrigger>
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="workspace in workspaces"
                  :key="workspace.id"
                  :value="workspace.id.toString()"
                >
                  {{ workspace.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="name">Project Name</Label>
            <Input
              id="name"
              v-model="newProject.name"
              placeholder="My Project"
              @keyup.enter="handleCreate"
            />
          </div>
          <div class="space-y-2">
            <Label for="description">Description (optional)</Label>
            <Textarea
              id="description"
              v-model="newProject.description"
              placeholder="Brief description of the project..."
              rows="3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateDialog = false">
            Cancel
          </Button>
          <Button @click="handleCreate" :disabled="!canCreate">
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import { Icon } from "@iconify/vue"
import { useWorkspaces } from "@/composables/useWorkspaces"
import { useProjects } from "@/composables/useProjects"
import { useWorkspaceContext } from "@/composables/useWorkspaceContext"
import { useToast } from "@/composables/useToast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const router = useRouter()
const { data: workspaces } = useWorkspaces()
const { data: projects, loading, error, fetchAll, create, patch } = useProjects()
const { setCurrentWorkspaceId, setCurrentProjectId } = useWorkspaceContext()
const { success: showSuccess, error: showError } = useToast()

const showCreateDialog = ref(false)
const searchQuery = ref("")
const editingProjectId = ref<number | null>(null)
const editingProjectName = ref("")
const editingProjectDescription = ref("")
const editingField = ref<"name" | "description" | null>(null)
const editSubmitting = ref(false)
const newProject = ref({
  name: "",
  description: "",
  workspaceId: "",
})

const projectsWithWorkspaces = computed(() => {
  return projects.value.map((project) => {
    const workspace = workspaces.value.find((w) => w.id === project.workspaceId)
    return {
      ...project,
      workspaceName: workspace?.name || "Unknown Workspace",
    }
  })
})

const showSearch = computed(() => projectsWithWorkspaces.value.length > 5)
const filteredProjects = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return projectsWithWorkspaces.value
  return projectsWithWorkspaces.value.filter((project) => {
    const name = project.name?.toLowerCase() ?? ""
    const description = project.description?.toLowerCase() ?? ""
    const workspaceName = project.workspaceName?.toLowerCase() ?? ""
    return (
      name.includes(query)
      || description.includes(query)
      || workspaceName.includes(query)
    )
  })
})

const canCreate = computed(() => {
  return newProject.value.name.trim() && newProject.value.workspaceId
})

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString()
}

function goToProject(project: { id: number; workspaceId: number }) {
  setCurrentWorkspaceId(project.workspaceId)
  setCurrentProjectId(project.id)
  router.push(`/projects/${project.id}`)
}

async function handleCreate() {
  if (!canCreate.value) return

  try {
    await create({
      name: newProject.value.name.trim(),
      description: newProject.value.description.trim() || undefined,
      workspaceId: parseInt(newProject.value.workspaceId, 10),
    })
    showSuccess("Project created", `"${newProject.value.name}" has been created successfully.`)
    newProject.value = { name: "", description: "", workspaceId: "" }
    showCreateDialog.value = false
    await fetchAll()
  } catch (e) {
    showError("Failed to create project", e instanceof Error ? e.message : "Unknown error")
  }
}

function startProjectEdit(project: { id: number; name: string }) {
  editingProjectId.value = project.id
  editingProjectName.value = project.name
  editingField.value = "name"
}

function cancelProjectEdit() {
  editingProjectId.value = null
  editingProjectName.value = ""
  editingProjectDescription.value = ""
  editingField.value = null
}

async function saveProjectName(project: { id: number; name: string }) {
  const nextName = editingProjectName.value.trim()
  if (!nextName) {
    showError("Name required", "Project name cannot be empty.")
    return
  }
  if (nextName === project.name) {
    cancelProjectEdit()
    return
  }
  try {
    editSubmitting.value = true
    const updated = await patch(project.id, { name: nextName })
    showSuccess("Project updated", `"${updated.name}" has been saved.`)
    cancelProjectEdit()
  } catch (e) {
    showError("Failed to update project", e instanceof Error ? e.message : "Unknown error")
  } finally {
    editSubmitting.value = false
  }
}

function startProjectDescriptionEdit(project: { id: number; description?: string | null }) {
  editingProjectId.value = project.id
  editingProjectDescription.value = project.description || ""
  editingField.value = "description"
}

async function saveProjectDescription(project: { id: number; description?: string | null }) {
  const nextDescription = editingProjectDescription.value.trim()
  if (nextDescription === (project.description || "")) {
    cancelProjectEdit()
    return
  }
  try {
    editSubmitting.value = true
    await patch(project.id, { description: nextDescription })
    showSuccess("Project updated", "Description has been saved.")
    cancelProjectEdit()
  } catch (e) {
    showError("Failed to update project", e instanceof Error ? e.message : "Unknown error")
  } finally {
    editSubmitting.value = false
  }
}

onMounted(() => {
  fetchAll()
})
</script>
