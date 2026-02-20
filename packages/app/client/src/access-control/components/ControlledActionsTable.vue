<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Controlled Actions</h2>
        <p class="text-sm text-muted-foreground mt-1">Manage permission actions</p>
      </div>
      <Button @click="openAddModal">
        <Plus class="w-4 h-4 mr-2" />
        Add Action
      </Button>
    </div>

    <!-- Table Section -->
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-20">ID</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead class="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="action in controlledActions" :key="action.id">
            <TableCell class="font-mono">{{ action.id }}</TableCell>
            <TableCell class="font-mono text-sm">{{ action.code }}</TableCell>
            <TableCell class="font-medium">{{ action.name }}</TableCell>
            <TableCell class="text-muted-foreground">{{ action.description || '-' }}</TableCell>
            <TableCell>
              <div class="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  @click="editAction(action)"
                >
                  <Pencil class="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-destructive hover:text-destructive"
                  @click="confirmDelete(action)"
                >
                  <Trash2 class="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="controlledActions.length === 0">
            <TableCell colspan="5" class="text-center text-muted-foreground py-8">
              <div v-if="loading" class="flex items-center justify-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                Loading...
              </div>
              <div v-else>No controlled actions found</div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <!-- Add Action Dialog -->
    <Dialog v-model:open="isAddModalOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Controlled Action</DialogTitle>
          <DialogDescription>
            Create a new permission action.
          </DialogDescription>
        </DialogHeader>
        
        <form class="space-y-4 py-4" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="actionCode">Code</Label>
            <Input
              id="actionCode"
              ref="codeInputRef"
              v-model="formState.code"
              placeholder="e.g., schedule:edit"
              :class="{ 'border-destructive': errors.code }"
            />
            <p v-if="errors.code" class="text-sm text-destructive">{{ errors.code }}</p>
          </div>
          
          <div class="space-y-2">
            <Label for="actionName">Name</Label>
            <Input
              id="actionName"
              v-model="formState.name"
              placeholder="e.g., Edit Schedule"
              :class="{ 'border-destructive': errors.name }"
            />
            <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
          </div>
          
          <div class="space-y-2">
            <Label for="actionDescription">Description</Label>
            <Input
              id="actionDescription"
              v-model="formState.description"
              placeholder="Optional description"
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" @click="isAddModalOpen = false">
            Cancel
          </Button>
          <Button @click="handleSubmit" :disabled="submitting">
            <Loader2 v-if="submitting" class="w-4 h-4 mr-2 animate-spin" />
            Create Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Action Dialog -->
    <Dialog v-model:open="isEditModalOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Controlled Action</DialogTitle>
          <DialogDescription>
            Update the permission action details.
          </DialogDescription>
        </DialogHeader>
        
        <form class="space-y-4 py-4" @submit.prevent="handleEditSubmit">
          <div class="space-y-2">
            <Label for="editActionCode">Code</Label>
            <Input
              id="editActionCode"
              v-model="editFormState.code"
              disabled
              class="bg-muted"
            />
            <p class="text-xs text-muted-foreground">Code cannot be changed</p>
          </div>
          
          <div class="space-y-2">
            <Label for="editActionName">Name</Label>
            <Input
              id="editActionName"
              ref="editNameInputRef"
              v-model="editFormState.name"
              placeholder="e.g., Edit Schedule"
              :class="{ 'border-destructive': editErrors.name }"
            />
            <p v-if="editErrors.name" class="text-sm text-destructive">{{ editErrors.name }}</p>
          </div>
          
          <div class="space-y-2">
            <Label for="editActionDescription">Description</Label>
            <Input
              id="editActionDescription"
              v-model="editFormState.description"
              placeholder="Optional description"
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" @click="isEditModalOpen = false">
            Cancel
          </Button>
          <Button @click="handleEditSubmit" :disabled="submitting">
            <Loader2 v-if="submitting" class="w-4 h-4 mr-2 animate-spin" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="isDeleteModalOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Controlled Action</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this controlled action? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div v-if="deletingAction" class="py-4">
          <div class="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div><strong>Code:</strong> {{ deletingAction.code }}</div>
            <div><strong>Name:</strong> {{ deletingAction.name }}</div>
            <div v-if="deletingAction.description">
              <strong>Description:</strong> {{ deletingAction.description }}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isDeleteModalOpen = false">
            Cancel
          </Button>
          <Button
            variant="solid"
            color="error"
            :disabled="submitting"
            @click="handleDelete"
          >
            <Loader2 v-if="submitting" class="w-4 h-4 mr-2 animate-spin" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue"
import { storeToRefs } from "pinia"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-vue-next"
import { z } from "zod"
import { useControlledActionsStore, type ControlledAction } from "../stores/controlledActions"
import { useToast } from "@/composables/useToast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
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

const store = useControlledActionsStore()
const { controlledActions, loading } = storeToRefs(store)
const { success, error: showError } = useToast()

// Form schemas
const actionSchema = z.object({
  code: z.string().min(1, "Code is required").max(64),
  name: z.string().min(1, "Name is required").max(64),
  description: z.string().max(256).optional(),
})

const editSchema = z.object({
  name: z.string().min(1, "Name is required").max(64),
  description: z.string().max(256).optional(),
})

// Modal states
const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const submitting = ref(false)

// Form states
const formState = reactive({
  code: "",
  name: "",
  description: "",
})

const editFormState = reactive({
  id: 0,
  code: "",
  name: "",
  description: "",
})

const errors = reactive<Record<string, string>>({})
const editErrors = reactive<Record<string, string>>({})

// Refs for focus management
const codeInputRef = ref<HTMLInputElement | null>(null)
const editNameInputRef = ref<HTMLInputElement | null>(null)

// Delete state
const deletingAction = ref<ControlledAction | null>(null)

function openAddModal() {
  formState.code = ""
  formState.name = ""
  formState.description = ""
  Object.keys(errors).forEach((k) => delete errors[k])
  isAddModalOpen.value = true
  nextTick(() => {
    codeInputRef.value?.focus()
  })
}

function editAction(action: ControlledAction) {
  editFormState.id = action.id
  editFormState.code = action.code
  editFormState.name = action.name
  editFormState.description = action.description || ""
  Object.keys(editErrors).forEach((k) => delete editErrors[k])
  isEditModalOpen.value = true
  nextTick(() => {
    editNameInputRef.value?.focus()
  })
}

function confirmDelete(action: ControlledAction) {
  deletingAction.value = action
  isDeleteModalOpen.value = true
}

async function handleSubmit() {
  Object.keys(errors).forEach((k) => delete errors[k])
  
  const result = actionSchema.safeParse(formState)
  if (!result.success) {
    result.error.errors.forEach((err) => {
      const path = err.path[0] as string
      errors[path] = err.message
    })
    return
  }

  submitting.value = true
  try {
    await store.create({
      code: formState.code.trim(),
      name: formState.name.trim(),
      description: formState.description?.trim() || undefined,
    })
    success("Controlled action created")
    isAddModalOpen.value = false
  } catch (e) {
    showError("Failed to create action", e instanceof Error ? e.message : "Unknown error")
  } finally {
    submitting.value = false
  }
}

async function handleEditSubmit() {
  Object.keys(editErrors).forEach((k) => delete editErrors[k])
  
  const result = editSchema.safeParse({
    name: editFormState.name,
    description: editFormState.description,
  })
  if (!result.success) {
    result.error.errors.forEach((err) => {
      const path = err.path[0] as string
      editErrors[path] = err.message
    })
    return
  }

  submitting.value = true
  try {
    await store.update(editFormState.id, {
      name: editFormState.name.trim(),
      description: editFormState.description?.trim() || undefined,
    })
    success("Controlled action updated")
    isEditModalOpen.value = false
  } catch (e) {
    showError("Failed to update action", e instanceof Error ? e.message : "Unknown error")
  } finally {
    submitting.value = false
  }
}

async function handleDelete() {
  if (!deletingAction.value) return
  
  submitting.value = true
  try {
    await store.remove(deletingAction.value.id)
    success("Controlled action deleted")
    isDeleteModalOpen.value = false
    deletingAction.value = null
  } catch (e) {
    showError("Failed to delete action", e instanceof Error ? e.message : "Unknown error")
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  store.fetchAll()
})
</script>
