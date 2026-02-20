// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Client-side auth store
// Last synced: 2026-01-31
// ============================================================================

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

// Helper to build URLs - handles both absolute and relative API_URL
function buildUrl(path: string): string {
  if (API_URL === '/' || API_URL === '') {
    // Relative URL - use current origin
    return path.startsWith('/') ? path : `/${path}`
  }
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export interface User {
  id: string
  email: string
  name: string
  roles: number[]
  controlledActions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value)
  
  const hasPermission = (action: string) => 
    user.value?.controlledActions?.includes(action) ?? false

  async function fetchSession() {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(buildUrl('/api/auth/session'), {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch session')
      }
      
      const data = await response.json() as { user: User | null }
      user.value = data.user
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      user.value = null
    } finally {
      loading.value = false
    }
  }

  function signIn(returnTo?: string) {
    const url = new URL(buildUrl('/auth/microsoft'), window.location.href)
    if (returnTo) {
      url.searchParams.set('returnTo', returnTo)
    }
    window.location.href = url.toString()
  }

  async function signOut() {
    try {
      await fetch(buildUrl('/auth/logout'), {
        method: 'POST',
        credentials: 'include'
      })
    } finally {
      user.value = null
      window.location.href = '/sign-in'
    }
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    hasPermission,
    fetchSession,
    signIn,
    signOut
  }
})
