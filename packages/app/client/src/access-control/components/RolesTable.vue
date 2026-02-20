<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Roles</h2>
        <p class="text-sm text-muted-foreground mt-1">Manage user roles and permissions</p>
      </div>
      <Button @click="openAddModal">
        <Plus class="w-4 h-4 mr-2" />
        Add Role
      </Button>
    </div>

    <!-- Table Section -->
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-12"></TableHead>
            <TableHead class="w-20">ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead class="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="role in roles" :key="role.id">
            <TableRow>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8"
                  @click="toggleExpand(role.id)"
                >
                  <ChevronDown
                    class="w-4 h-4 transition-transform"
                    :class="{ 'rotate-180': expanded.includes(role.id) }"
                  />
                </Button>
              </TableCell>
              <TableCell class="font-mono">{{ role.id }}</TableCell>
              <TableCell class="font-medium">{{ role.name }}</TableCell>
              <TableCell class="text-muted-foreground">{{ role.description || '-' }}</TableCell>
              <TableCell>
                <div class="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    :disabled="isProtected(role.id)"
                    @click="editRole(role)"
                  >
                    <Pencil class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8 text-destructive hover:text-destructive"
                    :disabled="isProtected(role.id)"
                    @click="confirmDelete(role)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            <!-- Expanded Row -->
            <TableRow v-if="expanded.includes(role.id)" class="bg-muted/50">
              <TableCell colspan="5" class="p-0">
                <RoleControlledActionsExpansion
                  :role="role"
                  @saved="onPermissionsSaved"
                />
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-if="roles.length === 0">
            <TableCell colspan="5" class="text-center text-muted-foreground py-8">
              <div v-if="loading" class="flex items-center justify-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                Loading...
              </div>
              <div v-else>No roles found</div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <!-- Add Role Dialog -->
    <Dialog v-model:open="isAddModalOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Role</DialogTitle>
          <DialogDescription>
            Enter a unique name for this role.
          </DialogDescription>
        </DialogHeader>
        
        <form class="space-y-4 py-4" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="roleName">Role Name</Label>
            <Input
              id="roleName"
              ref="nameInputRef"
              v-model="formState.name"
              placeholder="e.g., Studio Manager"
              :class="{ 'border-destructive': errors.name }"
            />
            <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
          </div>
          
          <div class="space-y-2">
            <Label for="roleDescription">Description</Label>
            <Input
              id="roleDescription"
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
            Create Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Role Dialog -->
    <Dialog v-model:open="isEditModalOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>
            Update the role details.
          </DialogDescription>
        </DialogHeader>
        
        <form class="space-y-4 py-4" @submit.prevent="handleEditSubmit">
          <div class="space-y-2">
            <Label for="editRoleName">Role Name</Label>
            <Input
              id="editRoleName"
              ref="editNameInputRef"
              v-model="editFormState.name"
              placeholder="e.g., Studio Manager"
              :class="{ 'border-destructive': editErrors.name }"
            />
            <p v-if="editErrors.name" class="text-sm text-destructive">{{ editErrors.name }}</p>
          </div>
          
          <div class="space-y-2">
            <Label for="editRoleDescription">Description</Label>
            <Input
              id="editRoleDescription"
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
          <DialogTitle>Delete Role</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this role? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div v-if="deletingRole" class="py-4">
          <div class="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div><strong>ID:</strong> {{ deletingRole.id }}</div>
            <div><strong>Name:</strong> {{ deletingRole.name }}</div>
            <div v-if="deletingRole.description">
              <strong>Description:</strong> {{ deletingRole.description }}
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
import { Plus, Pencil, Trash2, ChevronDown, Loader2 } from "lucide-vue-next"
import { z } from "zod"
import { useRolesStore, type Role } from "../stores/roles"
import { useToast } from "@/composables/useToast"
import { isProtectedRole } from "@wenyan/shared"
import RoleControlledActionsExpansion from "./RoleControlledActionsExpansion.vue"

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

const store = useRolesStore()
const { roles, loading } = storeToRefs(store)
const { success, error: showError } = useToast()

// Expansion state
const expanded = ref<number[]>([])

// Form schemas
const roleSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(256).optional(),
})

// Modal states
const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const submitting = ref(false)

// Form states
const formState = reactive({
  name: "",
  description: "",
})

const editFormState = reactive({
  id: 0,
  name: "",
  description: "",
})

const errors = reactive<Record<string, string>>({})
const editErrors = reactive<Record<string, string>>({})

// Refs for focus management
const nameInputRef = ref<HTMLInputElement | null>(null)
const editNameInputRef = ref<HTMLInputElement | null>(null)

// Delete state
const deletingRole = ref<Role | null>(null)

function isProtected(id: number): boolean {
  return isProtectedRole(id)
}

function toggleExpand(roleId: number) {
  if (expanded.value.includes(roleId)) {
    expanded.value = expanded.value.filter((id) => id !== roleId)
    return
  }
  expanded.value = [...expanded.value, roleId]
}

function openAddModal() {
  formState.name = ""
  formState.description = ""
  Object.keys(errors).forEach((k) => delete errors[k])
  isAddModalOpen.value = true
  nextTick(() => {
    nameInputRef.value?.focus()
  })
}

function editRole(role: Role) {
  if (isProtectedRole(role.id)) return
  
  editFormState.id = role.id
  editFormState.name = role.name
  editFormState.description = role.description || ""
  Object.keys(editErrors).forEach((k) => delete editErrors[k])
  isEditModalOpen.value = true
  nextTick(() => {
    editNameInputRef.value?.focus()
  })
}

function confirmDelete(role: Role) {
  if (isProtectedRole(role.id)) return
  
  deletingRole.value = role
  isDeleteModalOpen.value = true
}

function onPermissionsSaved() {
  success("Role permissions updated")
}

async function handleSubmit() {
  Object.keys(errors).forEach((k) => delete errors[k])
  
  const result = roleSchema.safeParse(formState)
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
      name: formState.name.trim(),
      description: formState.description?.trim() || undefined,
    })
    success("Role created")
    isAddModalOpen.value = false
  } catch (e) {
    showError("Failed to create role", e instanceof Error ? e.message : "Unknown error")
  } finally {
    submitting.value = false
  }
}

async function handleEditSubmit() {
  Object.keys(editErrors).forEach((k) => delete editErrors[k])
  
  if (isProtectedRole(editFormState.id)) {
    showError("Cannot modify protected system role")
    return
  }
  
  const result = roleSchema.safeParse({
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
    success("Role updated")
    isEditModalOpen.value = false
  } catch (e) {
    showError("Failed to update role", e instanceof Error ? e.message : "Unknown error")
  } finally {
    submitting.value = false
  }
}

async function handleDelete() {
  if (!deletingRole.value) return
  
  if (isProtectedRole(deletingRole.value.id)) {
    showError("Cannot delete protected system role")
    return
  }
  
  submitting.value = true
  try {
    await store.remove(deletingRole.value.id)
    success("Role deleted")
    isDeleteModalOpen.value = false
    deletingRole.value = null
  } catch (e) {
    showError("Failed to delete role", e instanceof Error ? e.message : "Unknown error")
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  store.fetchAll()
})
</script>
