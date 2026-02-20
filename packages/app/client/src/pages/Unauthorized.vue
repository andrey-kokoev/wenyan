<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="w-full max-w-md text-center">
      <!-- Icon -->
      <div class="mx-auto w-16 h-16 bg-error-red-100 dark:bg-error-red-900/30 rounded-full flex items-center justify-center mb-6">
        <svg
          class="w-8 h-8 text-error-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>

      <h1 class="text-2xl font-bold text-foreground mb-2">
        Access Denied
      </h1>
      <p class="text-muted-foreground mb-6">
        You don't have permission to access this page.
      </p>

      <div class="space-y-3">
        <button
          @click="goHome"
          class="w-full px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
        >
          Go Home
        </button>
        <button
          @click="signOut"
          class="w-full px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../auth'

const router = useRouter()
const auth = useAuthStore()

function goHome() {
  router.push('/')
}

async function signOut() {
  await auth.signOut()
}
</script>
