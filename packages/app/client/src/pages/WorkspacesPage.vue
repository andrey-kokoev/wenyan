<template>
  <div class="container mx-auto py-8 px-4">
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p class="text-muted-foreground">
            Manage your workspaces and access.
          </p>
        </div>
        <Button @click="showCreateDialog = true">
          <Icon icon="heroicons:plus" class="w-4 h-4 mr-2" />
          New Workspace
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Workspaces</CardTitle>
          <CardDescription>
            View available workspaces or delete ones you own.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="showSearch" class="mb-4 max-w-md">
            <Input v-model="searchQuery" placeholder="Search workspaces..." />
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

          <div v-else-if="workspaces.length === 0" class="text-center py-8">
            <Icon icon="heroicons:briefcase" class="w-12 h-12 mx-auto text-muted-foreground" />
            <p class="mt-4 text-muted-foreground">No workspaces yet.</p>
            <p class="text-sm text-muted-foreground">Create your first workspace to get started.</p>
          </div>

          <div v-else-if="filteredWorkspaces.length === 0" class="text-center py-8 border rounded-lg">
            <Icon icon="heroicons:magnifying-glass" class="w-12 h-12 mx-auto text-muted-foreground" />
            <p class="mt-4 text-muted-foreground">No workspaces match your search.</p>
            <p class="text-sm text-muted-foreground">Try a different keyword.</p>
          </div>

          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="workspace in filteredWorkspaces"
                :key="workspace.id"
                class="cursor-pointer hover:bg-muted/50"
                @click="goToWorkspace(workspace.id)"
              >
                <TableCell class="group font-medium">
                  <div class="flex items-center gap-2 min-w-0">
                    <Icon icon="heroicons:briefcase" class="w-4 h-4 text-primary" />
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                      <div v-if="editingWorkspaceId === workspace.id" class="flex flex-1 items-center gap-1">
                        <Input
                          v-model="editingWorkspaceName"
                          class="h-8 flex-1"
                          @click.stop
                          @keyup.enter="saveWorkspaceName(workspace)"
                          @keyup.esc="cancelWorkspaceEdit"
                        />
                        <Button
                          size="sm"
                          variant="link"
                          class="h-7 w-7 p-0"
                          :disabled="editSubmitting"
                          @click.stop="saveWorkspaceName(workspace)"
                        >
                          <Icon icon="heroicons:check" class="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="link"
                          class="h-7 w-7 p-0 text-muted-foreground"
                          :disabled="editSubmitting"
                          @click.stop="cancelWorkspaceEdit"
                        >
                          <Icon icon="heroicons:x-mark" class="h-4 w-4" />
                        </Button>
                      </div>
                      <div v-else class="flex min-w-0 flex-1 items-center gap-2">
                        <span class="truncate">{{ workspace.name }}</span>
                        <Button
                          v-if="canEdit(workspace)"
                          variant="link"
                          size="sm"
                          class="ml-auto h-7 w-7 p-0 opacity-0 transition group-hover:opacity-100"
                          @click.stop="startWorkspaceEdit(workspace)"
                        >
                          <Icon icon="heroicons:pencil-square" class="h-4 w-4" />
                          <span class="sr-only">Edit name</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {{ workspace.isPersonal ? "Personal" : "" }}
                </TableCell>
                <TableCell>{{ formatDate(workspace.createdAt) }}</TableCell>
                <TableCell class="text-right">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="link"
                        size="sm"
                        class="h-8 w-8 p-0"
                        @click.stop="handleCloneWorkspace(workspace)"
                      >
                        <Icon icon="heroicons:document-duplicate" class="h-4 w-4" />
                        <span class="sr-only">Clone workspace</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Clone workspace with its attached rules
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip v-if="canDelete(workspace)">
                    <TooltipTrigger as-child>
                      <Button
                        variant="link"
                        color="error"
                        size="sm"
                        class="h-8 w-8 p-0 text-destructive"
                        @click.stop="openDeleteDialog(workspace)"
                      >
                        <Icon icon="heroicons:trash" class="h-4 w-4" />
                        <span class="sr-only">Delete</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Delete workspace
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="link"
                        size="sm"
                        class="h-8 w-8 p-0"
                        @click.stop="goToWorkspace(workspace.id)"
                      >
                        <Icon icon="heroicons:eye" class="h-4 w-4" />
                        <span class="sr-only">View</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      View workspace
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <Dialog v-model:open="showCreateDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              v-model="newWorkspaceName"
              placeholder="My Workspace"
              @keyup.enter="handleCreateWorkspace"
            />
          </div>
          <Button variant="link" class="w-full" @click="handleCreateWorkspace">
            Create Workspace
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="isDeleteDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Workspace</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <p class="text-sm text-muted-foreground">
            This will permanently delete the workspace and all its projects, documents, and issues.
          </p>
          <p v-if="deleteTarget" class="text-sm">
            Type <span class="font-medium">"{{ deletePrompt }}"</span> to confirm.
          </p>
          <Input v-model="deleteConfirmation" placeholder="delete workspace-name" />
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="isDeleteDialogOpen = false">Cancel</Button>
            <Button
              color="error"
              :disabled="!canDeleteWorkspace"
              @click="confirmDeleteWorkspace"
            >
              Delete Workspace
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { Icon } from "@iconify/vue"
import { useWorkspaces } from "@/composables/useWorkspaces"
import { useWorkspaceContext } from "@/composables/useWorkspaceContext"
import { useToast } from "@/composables/useToast"
import { useAuthStore } from "@/auth"
import { isAdmin } from "@wenyan/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const { data: workspaces, loading, error, fetchAll, create, remove, clone, patch } = useWorkspaces()
const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceContext()
const { error: showError, success: showSuccess } = useToast()
const auth = useAuthStore()
const router = useRouter()

const showCreateDialog = ref(false)
const newWorkspaceName = ref("")

const isDeleteDialogOpen = ref(false)
const deleteConfirmation = ref("")
const deleteTarget = ref<{ id: number; name: string; isPersonal: boolean; ownerId: string } | null>(null)
const searchQuery = ref("")
const editingWorkspaceId = ref<number | null>(null)
const editingWorkspaceName = ref("")
const editSubmitting = ref(false)

onMounted(async () => {
  await fetchAll()
})

const deletePrompt = computed(() =>
  deleteTarget.value ? `delete ${deleteTarget.value.name}` : "",
)

const canDeleteWorkspace = computed(() =>
  deleteConfirmation.value.trim() === deletePrompt.value,
)

const showSearch = computed(() => workspaces.value.length > 5)
const filteredWorkspaces = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return workspaces.value
  return workspaces.value.filter((workspace) => {
    const name = workspace.name?.toLowerCase() ?? ""
    return name.includes(query)
  })
})

function openDeleteDialog(workspace: { id: number; name: string; isPersonal: boolean; ownerId: string }) {
  if (!canDelete(workspace)) {
    showError("Not allowed", "You do not have permission to delete this workspace.")
    return
  }
  deleteTarget.value = workspace
  deleteConfirmation.value = ""
  isDeleteDialogOpen.value = true
}

async function confirmDeleteWorkspace() {
  if (!deleteTarget.value || !canDeleteWorkspace.value) return
  const target = deleteTarget.value
  try {
    await remove(target.id)
    if (currentWorkspaceId.value === target.id) {
      const next = workspaces.value.find((w) => w.isPersonal) ?? workspaces.value[0]
      if (next) {
        setCurrentWorkspaceId(next.id)
      }
    }
    showSuccess("Workspace deleted", `"${target.name}" has been deleted.`)
    isDeleteDialogOpen.value = false
    deleteTarget.value = null
  } catch (e) {
    console.error("Failed to delete workspace:", e)
    showError(
      "Failed to delete workspace",
      e instanceof Error ? e.message : "An unexpected error occurred.",
    )
    isDeleteDialogOpen.value = false
    deleteTarget.value = null
  }
}

async function handleCloneWorkspace(workspace: { id: number; name: string }) {
  try {
    const cloned = await clone(workspace.id)
    showSuccess("Workspace cloned", `"${cloned.name}" has been created.`)
  } catch (e) {
    console.error("Failed to clone workspace:", e)
    showError(
      "Failed to clone workspace",
      e instanceof Error ? e.message : "An unexpected error occurred.",
    )
  }
}

function canDelete(workspace: { isPersonal: boolean; ownerId?: string }) {
  if (workspace.isPersonal) return false
  const user = auth.user
  if (!user) return false
  if (isAdmin(user.roles)) return true
  return Boolean(workspace.ownerId && workspace.ownerId === user.email)
}

function canEdit(workspace: { ownerId?: string }) {
  const user = auth.user
  if (!user) return false
  if (isAdmin(user.roles)) return true
  return Boolean(workspace.ownerId && workspace.ownerId === user.email)
}

async function handleCreateWorkspace() {
  if (!newWorkspaceName.value.trim()) return

  try {
    const workspace = await create({ name: newWorkspaceName.value.trim() })
    setCurrentWorkspaceId(workspace.id)
    newWorkspaceName.value = ""
    showCreateDialog.value = false
    showSuccess("Workspace created", `"${workspace.name}" has been created successfully.`)
  } catch (e) {
    console.error("Failed to create workspace:", e)
    showError(
      "Failed to create workspace",
      e instanceof Error ? e.message : "An unexpected error occurred. Please try again.",
    )
  }
}

function formatDate(timestamp?: number | string | null) {
  if (!timestamp) return "—"
  const date = new Date(
    typeof timestamp === "string" ? Number(timestamp) * 1000 : timestamp * 1000,
  )
  return date.toLocaleDateString()
}

function goToWorkspace(id: number) {
  setCurrentWorkspaceId(id)
  router.push(`/workspaces/${id}`)
}

function startWorkspaceEdit(workspace: { id: number; name: string }) {
  editingWorkspaceId.value = workspace.id
  editingWorkspaceName.value = workspace.name
}

function cancelWorkspaceEdit() {
  editingWorkspaceId.value = null
  editingWorkspaceName.value = ""
}

async function saveWorkspaceName(workspace: { id: number; name: string }) {
  const nextName = editingWorkspaceName.value.trim()
  if (!nextName) {
    showError("Name required", "Workspace name cannot be empty.")
    return
  }
  if (nextName === workspace.name) {
    cancelWorkspaceEdit()
    return
  }
  try {
    editSubmitting.value = true
    const updated = await patch(workspace.id, { name: nextName })
    showSuccess("Workspace updated", `"${updated.name}" has been saved.`)
    cancelWorkspaceEdit()
  } catch (e) {
    console.error("Failed to update workspace:", e)
    showError(
      "Failed to update workspace",
      e instanceof Error ? e.message : "An unexpected error occurred.",
    )
  } finally {
    editSubmitting.value = false
  }
}
</script>
