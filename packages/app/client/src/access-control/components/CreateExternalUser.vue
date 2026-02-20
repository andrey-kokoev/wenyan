<template>
  <Card class="p-6">
    <h3 class="text-lg font-semibold mb-4">Assign Role to User</h3>
    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="email">Email</Label>
        <Input id="email" v-model="form.email" placeholder="user@example.com" />
      </div>
      <div class="space-y-2">
        <Label for="role">Role</Label>
        <Input id="role" v-model="form.roleId" placeholder="Role ID" />
      </div>
      <Button @click="submit" :disabled="submitting">
        <Loader2 v-if="submitting" class="w-4 h-4 mr-2 animate-spin" />
        Assign Role
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue"
import { Loader2 } from "lucide-vue-next"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const API_URL = import.meta.env.VITE_API_URL || ""

const form = reactive({
  email: "",
  roleId: "",
})

const submitting = ref(false)

async function submit() {
  if (!form.email || !form.roleId) return
  
  const roleIdNum = parseInt(form.roleId, 10)
  
  submitting.value = true
  try {
    const response = await fetch(`${API_URL}/api/access-control/external-user-ids-rel-roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        externalUserId: form.email,
        roleId: roleIdNum,
      }),
    })
    if (!response.ok) throw new Error("Failed to assign role")
    form.email = ""
    form.roleId = ""
  } finally {
    submitting.value = false
  }
}
</script>
