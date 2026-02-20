<template>
  <div class="min-h-screen flex items-center justify-center bg-background px-4">
    <div class="w-full max-w-md">
      <!-- Logo / Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-foreground">
          Wenyan
        </h1>
        <p class="mt-2 text-sm text-muted-foreground">
          Sign in to access the application
        </p>
      </div>

      <!-- Error Alert -->
      <div
        v-if="errorMessage"
        class="mb-6 p-4 rounded-lg bg-error-red-50 dark:bg-error-red-900/20 border border-error-red-200 dark:border-error-red-800"
      >
        <div class="flex items-start">
          <svg
            class="w-5 h-5 text-error-red-500 mt-0.5 mr-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 class="text-sm font-medium text-error-red-800 dark:text-error-red-200">
              {{ errorTitle }}
            </h3>
            <p class="mt-1 text-sm text-error-red-700 dark:text-error-red-300">
              {{ errorMessage }}
            </p>
          </div>
        </div>
      </div>

      <!-- Sign In Card -->
      <div class="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
        <div class="p-6">
          <h2 class="text-lg font-semibold text-card-foreground mb-4">
            Sign In
          </h2>

          <!-- Microsoft Sign In Button -->
          <button
            @click="handleSignIn"
            :disabled="isLoading"
            class="w-full flex items-center justify-center gap-3 px-4 py-3 bg-card border border-border rounded-lg text-foreground font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              v-if="!isLoading"
              class="w-5 h-5"
              viewBox="0 0 21 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            <svg
              v-else
              class="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{{ isLoading ? 'Redirecting...' : 'Sign in with Microsoft' }}</span>
          </button>

          <p class="mt-4 text-xs text-center text-muted-foreground">
            By signing in, you agree to our
            <a href="#" class="text-primary hover:underline">Terms of Service</a>
            and
            <a href="#" class="text-primary hover:underline">Privacy Policy</a>
          </p>

          <!-- Dev Login Button (only in development) -->
          <div v-if="isDev" class="mt-6 pt-6 border-t border-border">
            <p class="text-xs text-center text-muted-foreground mb-3">
              Development Mode
            </p>
            <button
              @click="handleDevSignIn"
              class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-muted border border-border rounded-lg text-foreground text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span>Dev Login (Bypass OAuth)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Help Link -->
      <div class="mt-6 text-center">
        <p class="text-sm text-muted-foreground">
          Need help?
          <a href="#" class="text-primary hover:underline font-medium">
            Contact support
          </a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isLoading = ref(false)

// Check if running in development mode
const isDev = computed(() => {
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1'
})

// Error handling from query params
const errorCode = computed(() => route.query.error as string | undefined)
const returnTo = computed(() => route.query.returnTo as string | undefined)

const errorTitle = computed(() => {
  switch (errorCode.value) {
    case 'no_email':
      return 'Email Not Found'
    case 'no_roles':
      return 'Access Denied'
    case 'no_permissions':
      return 'Insufficient Permissions'
    case 'unauthorized_domain':
      return 'Unauthorized Domain'
    case 'no_approved_domains':
      return 'System Not Configured'
    case 'invalid_state':
    case 'code_expired':
      return 'Session Expired'
    case 'oauth_failed':
      return 'Authentication Failed'
    default:
      return 'Authentication Error'
  }
})

const errorMessage = computed(() => {
  switch (errorCode.value) {
    case 'no_email':
      return 'We could not retrieve your email from Microsoft. Please ensure your Microsoft account has a valid email address.'
    case 'no_roles':
      return 'Your account does not have any roles assigned. Please contact your administrator for access.'
    case 'no_permissions':
      return 'Your account does not have permission to access this application.'
    case 'unauthorized_domain':
      return `The email domain "${route.query.domain}" is not authorized to access this application.`
    case 'no_approved_domains':
      return 'The system has not been configured with approved domains. Please contact your administrator.'
    case 'invalid_state':
    case 'code_expired':
      return 'Your session has expired. Please try signing in again.'
    case 'oauth_failed':
      return 'Something went wrong during authentication. Please try again.'
    default:
      return errorCode.value 
        ? `An error occurred during sign in (${errorCode.value}). Please try again.`
        : ''
  }
})

// If already authenticated, redirect
onMounted(async () => {
  await auth.fetchSession()
  if (auth.isAuthenticated) {
    const redirect = returnTo.value || '/'
    router.replace(redirect)
  }
})

async function handleSignIn() {
  isLoading.value = true
  auth.signIn(returnTo.value)
}

function handleDevSignIn() {
  // Build dev login URL
  // Note: No fallback is provided intentionally - if VITE_API_URL is not set,
  // it indicates a misconfiguration that should be fixed rather than silently
  // using a default that may point to the wrong environment.
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) {
    console.error('VITE_API_URL environment variable is not set')
    alert('Development login is not configured. Please set VITE_API_URL environment variable.')
    return
  }
  const redirect = returnTo.value || '/'
  window.location.href = `${apiUrl}/auth/dev-login?returnTo=${encodeURIComponent(redirect)}`
}
</script>
