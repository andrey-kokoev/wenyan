<template>
  <div class="relative">
    <!-- User Button -->
    <button @click="isOpen = !isOpen"
      class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors">
      <!-- Avatar -->
      <div
        class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
        {{ initials }}
      </div>

      <!-- Name (hidden on mobile) -->
      <span class="hidden sm:block text-sm font-medium text-foreground">
        {{ auth.user?.name }}
      </span>

      <!-- Dropdown Icon -->
      <svg class="w-4 h-4 text-muted-foreground transition-transform" :class="{ 'rotate-180': isOpen }" fill="none"
        stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <Transition enter-active-class="transition duration-100 ease-out" enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100" leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100" leave-to-class="transform scale-95 opacity-0">
      <div v-if="isOpen"
        class="absolute right-0 mt-2 w-56 rounded-lg bg-popover shadow-lg border border-border py-1 z-50">
        <!-- User Info -->
        <div class="px-4 py-3 border-b border-border bg-muted">
          <p class="text-sm font-medium text-popover-foreground">
            {{ auth.user?.name }}
          </p>
          <p class="text-sm text-muted-foreground truncate">
            {{ auth.user?.email }}
          </p>
        </div>

        <!-- Menu Items -->
        <div class="py-1">
          <router-link to="/user/user-settings"
            class="flex items-center px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
            @click="isOpen = false">
            <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            User settings
          </router-link>

          <!-- Theme Toggle -->
          <button @click="toggleTheme"
            class="flex w-full items-center px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground">
            <svg v-if="isDark" class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            {{ isDark ? "Light Mode" : "Dark Mode" }}
          </button>
        </div>

        <!-- Admin Section (if has admin permission) -->
        <div v-if="isAdmin" class="py-1 border-t border-border">
          <router-link to="/admin"
            class="flex items-center px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
            @click="isOpen = false">
            <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Admin
          </router-link>
        </div>

        <!-- Sign Out -->
        <div class="py-1 border-t border-border">
          <button @click="handleSignOut"
            class="flex w-full items-center px-4 py-2 text-sm text-destructive hover:bg-accent hover:text-accent-foreground">
            <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </Transition>

    <!-- Backdrop for closing -->
    <div v-if="isOpen" class="fixed inset-0 z-40" @click="isOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { useAuthStore } from "../auth"
import { useThemePreference } from "../composables/useThemePreference"
import { useToast } from "@/composables/useToast"

const auth = useAuthStore()
const { colorMode, setThemeMode } = useThemePreference()
const { error: showError } = useToast()
const isOpen = ref(false)

const prefersDark = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches

const isDark = computed(() => {
  if (colorMode.value === "dark") return true
  if (colorMode.value === "light") return false
  return prefersDark()
})

function toggleTheme() {
  setThemeMode(isDark.value ? "light" : "dark")
  // Don't close menu so user can see the change
}

const initials = computed(() => {
  const name = auth.user?.name || ""
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
})

const isAdmin = computed(() => {
  return auth.hasPermission("configure_application")
})

async function handleSignOut() {
  isOpen.value = false
  try {
    await auth.signOut()
  } catch (err) {
    console.error("Sign out failed:", err)
    showError("Sign out failed", "Check your connection and try again.")
  }
}
</script>
