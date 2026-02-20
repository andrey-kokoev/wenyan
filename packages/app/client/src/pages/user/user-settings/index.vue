<script setup lang="ts">
import { computed } from "vue"
import { useSignedInUser } from "@/access-control"
import UserSettings from "@/components/UserSettings.vue"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

const { user, isLoggedIn, load } = useSignedInUser()

// Load user data on mount
load()

const maskedEmail = computed(() => {
  if (!user.value?.email) return "Not available"
  const email = user.value.email
  const [name, domain] = email.split("@")
  if (!domain) return email
  const maskedName = name.charAt(0) + "***"
  return `${maskedName}@${domain}`
})

const displayName = computed(() => {
  return user.value?.name || user.value?.email?.split("@")[0] || "User"
})

const userId = computed(() => {
  return user.value?.id || "Not available"
})
</script>

<template>
  <div class="container mx-auto max-w-4xl py-8 px-4">
    <h1 class="text-3xl font-bold mb-8">Settings</h1>
    
    <div class="space-y-6">
      <!-- Account Information Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your account details and sign-in information
              </CardDescription>
            </div>
            <Badge variant="outline">Account</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="!isLoggedIn" class="space-y-4">
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
          </div>
          
          <div v-else class="space-y-4">
            <div class="space-y-2">
              <Label for="displayName">Name</Label>
              <Input 
                id="displayName" 
                :model-value="displayName" 
                disabled 
                readonly 
              />
            </div>
            
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input 
                id="email" 
                :model-value="maskedEmail" 
                disabled 
                readonly 
                class="font-mono"
              />
            </div>
            
            <div class="space-y-2">
              <Label for="userId">User ID</Label>
              <Input 
                id="userId" 
                :model-value="userId" 
                disabled 
                readonly 
                class="font-mono text-sm"
              />
            </div>
            
            <p class="text-sm text-muted-foreground pt-2">
              This information is managed by your account provider and cannot be edited here.
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- User Settings Component -->
      <UserSettings />
    </div>
  </div>
</template>
