<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">External Users</h2>
        <p class="text-sm text-muted-foreground mt-1">Manage external user role assignments</p>
      </div>
      <Button @click="openAddModal">
        <Plus class="w-4 h-4 mr-2" />
        Add User
      </Button>
    </div>

    <!-- Table Section -->
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead class="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="mapping in mappings" :key="mapping.id">
            <TableCell>{{ mapping.externalUserId }}</TableCell>
            <TableCell>
              <span v-if="getRoleName(mapping.roleId)" class="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                {{ getRoleName(mapping.roleId) }}
              </span>
              <span v-else class="font-mono text-muted-foreground">Role #{{ mapping.roleId }}</span>
            </TableCell>
            <TableCell>
              <div class="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-destructive hover:text-destructive"
                  @click="confirmDelete(mapping)"
                >
                  <Trash2 class="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="mappings.length === 0">
            <TableCell colspan="3" class="text-center text-muted-foreground py-8">
              <div v-if="loading" class="flex items-center justify-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                Loading...
              </div>
              <div v-else>No external user mappings found</div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <!-- Add User Dialog -->
    <Dialog v-model:open="isAddModalOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add External User</DialogTitle>
          <DialogDescription>
            Assign a role to an external user by email.
          </DialogDescription>
        </DialogHeader>
        
        <form class="space-y-4 py-4" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <Label for="userEmail">Email</Label>
            <Input
              id="userEmail"
              ref="emailInputRef"
              v-model="formState.externalUserId"
              type="email"
              placeholder="user@example.com"
              :class="{ 'border-destructive': errors.externalUserId }"
            />
            <p v-if="errors.externalUserId" class="text-sm text-destructive">{{ errors.externalUserId }}</p>
          </div>
          
          <div class="space-y-2">
            <Label for="userRole">Role</Label>
            <Select v-model="formState.roleId">
              <SelectTrigger :class="{ 'border-destructive': errors.roleId }">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="role in roles"
                  :key="role.id"
                  :value="role.id"
                >
                  {{ role.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.roleId" class="text-sm text-destructive">{{ errors.roleId }}</p>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" @click="isAddModalOpen = false">
            Cancel
          </Button>
          <Button @click="handleSubmit" :disabled="submitting">
            <Loader2 v-if="submitting" class="w-4 h-4 mr-2 animate-spin" />
            Add User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="isDeleteModalOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove User Assignment</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this user's role assignment?
          </DialogDescription>
        </DialogHeader>
        
        <div v-if="deletingMapping" class="py-4">
          <div class="rounded-md bg-muted p-4 space-y-2 text-sm">
            <div><strong>Email:</strong> {{ deletingMapping.externalUserId }}</div>
            <div><strong>Role:</strong> {{ getRoleName(deletingMapping.roleId) || `Role #${deletingMapping.roleId}` }}</div>
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
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue"
import { storeToRefs } from "pinia"
import { Plus, Trash2, Loader2 } from "lucide-vue-next"
import { z } from "zod"
import { useExternalUsersStore, type ExternalUserIdRelRole } from "../stores/externalUsers"
import { useRolesStore } from "../stores/roles"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const externalStore = useExternalUsersStore()
const { mappings, loading } = storeToRefs(externalStore)

const rolesStore = useRolesStore()
const { roles, loaded: rolesLoaded } = storeToRefs(rolesStore)

const { success, error: showError } = useToast()

// Form schema
const userSchema = z.object({
  externalUserId: z.string().email("Valid email is required"),
  roleId: z.number().min(1, "Role is required"),
})

// Modal states
const isAddModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const submitting = ref(false)

// Form state
const formState = reactive({
  externalUserId: "",
  roleId: undefined as number | undefined,
})

const errors = reactive<Record<string, string>>({})

// Refs for focus management
const emailInputRef = ref<HTMLInputElement | null>(null)

// Delete state
const deletingMapping = ref<ExternalUserIdRelRole | null>(null)

function getRoleName(roleId: number): string | undefined {
  return rolesStore.getNameById(roleId)
}

function openAddModal() {
  formState.externalUserId = ""
  formState.roleId = undefined
  Object.keys(errors).forEach((k) => delete errors[k])
  isAddModalOpen.value = true
  nextTick(() => {
    emailInputRef.value?.focus()
  })
}

function confirmDelete(mapping: ExternalUserIdRelRole) {
  deletingMapping.value = mapping
  isDeleteModalOpen.value = true
}

async function handleSubmit() {
  Object.keys(errors).forEach((k) => delete errors[k])
  
  const result = userSchema.safeParse({
    externalUserId: formState.externalUserId,
    roleId: formState.roleId,
  })
  if (!result.success) {
    result.error.errors.forEach((err) => {
      const path = err.path[0] as string
      errors[path] = err.message
    })
    return
  }

  if (!formState.roleId) return

  submitting.value = true
  try {
    await externalStore.create({
      externalUserId: formState.externalUserId.trim(),
      roleId: formState.roleId,
    })
    success("User role assignment created")
    isAddModalOpen.value = false
  } catch (e) {
    showError("Failed to create assignment", e instanceof Error ? e.message : "Unknown error")
  } finally {
    submitting.value = false
  }
}

async function handleDelete() {
  if (!deletingMapping.value) return
  
  submitting.value = true
  try {
    await externalStore.remove(deletingMapping.value.id)
    success("User role assignment removed")
    isDeleteModalOpen.value = false
    deletingMapping.value = null
  } catch (e) {
    showError("Failed to remove assignment", e instanceof Error ? e.message : "Unknown error")
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  externalStore.fetchAll()
  if (!rolesLoaded.value) {
    rolesStore.fetchAll()
  }
})
</script>
