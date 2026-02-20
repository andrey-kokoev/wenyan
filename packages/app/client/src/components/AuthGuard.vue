<template>
  <div v-if="isLoading" class="min-h-screen flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <svg class="w-8 h-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <p class="text-muted-foreground">Loading...</p>
    </div>
  </div>

  <div v-else-if="error" class="min-h-screen flex items-center justify-center px-4">
    <div class="text-center">
      <h1 class="text-xl font-semibold text-destructive mb-2">Error</h1>
      <p class="text-muted-foreground">{{ error }}</p>
      <button
        @click="retry"
        class="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        Retry
      </button>
    </div>
  </div>
  
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../auth'

const auth = useAuthStore()

const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    await auth.fetchSession()
  } catch (e: unknown) {
    console.error('Authentication check failed:', e)
    // Handle all error types safely
    if (e instanceof Error) {
      error.value = `Authentication error: ${e.message}`
    } else if (typeof e === 'string') {
      error.value = `Authentication error: ${e}`
    } else {
      error.value = 'Failed to check authentication status'
    }
  } finally {
    isLoading.value = false
  }
})

function retry() {
  error.value = null
  isLoading.value = true
  auth.fetchSession()
    .catch((e: unknown) => {
      console.error('Authentication retry failed:', e)
      // Handle all error types safely
      if (e instanceof Error) {
        error.value = `Authentication error: ${e.message}`
      } else if (typeof e === 'string') {
        error.value = `Authentication error: ${e}`
      } else {
        error.value = 'Failed to check authentication status'
      }
    })
    .finally(() => {
      isLoading.value = false
    })
}
</script>
