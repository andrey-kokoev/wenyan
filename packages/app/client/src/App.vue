<script setup lang="ts">
import { computed } from "vue"
import { useAuthStore } from "./auth"
import { useUiStore } from "./stores/ui"
import AuthGuard from "./components/AuthGuard.vue"
import NavPanel from "./components/features/navigation/NavPanel.vue"

import Button from "./components/ui/button/Button.vue"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./components/ui/tooltip"
import { Toaster } from "./components/ui/toast"

const auth = useAuthStore()
const ui = useUiStore()

// Layout computed properties
const sidebarClasses = computed(() => [
  "flex flex-col h-full bg-elevated border-r border-sidebar-border",
  "transition-all duration-300 ease-in-out",
  ui.sidebarWidthClass,
])

const leftRailClasses = computed(() => [
  "flex flex-col items-center py-4 bg-canvas",
  ui.railWidthClass,
])

const rightRailClasses = computed(() => [
  "flex flex-col items-center py-4 bg-canvas",
  ui.railWidthClass,
])

function closeSidebarOnMobile() {
  if (window.innerWidth < 768) {
    ui.setSidebarVisible(false)
  }
}
</script>

<template>
  <TooltipProvider>
    <div id="app" class="min-h-screen bg-background text-foreground">
      <AuthGuard>
        <div class="flex h-screen overflow-hidden">
          <!-- Primary Sidebar (Navigation) -->
          <aside
            v-if="auth.isAuthenticated && ui.isSidebarVisible"
            :class="sidebarClasses"
            class="hidden md:flex"
          >
            <!-- Sidebar Header -->
            <div class="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
              <router-link
                v-if="!ui.isSidebarCollapsed"
                to="/"
                class="flex items-center gap-2 overflow-hidden"
              >
                <span class="text-lg font-bold text-sidebar-foreground truncate"> Wenyan </span>
              </router-link>

              <Tooltip v-if="!ui.isSidebarCollapsed">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="p-1.5"
                    @click="ui.toggleSidebarCollapsed()"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M9 3v18" />
                      <path d="m10 9-3 3 3 3" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collapse sidebar</TooltipContent>
              </Tooltip>

              <Tooltip v-else>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="p-1.5"
                    @click="ui.toggleSidebarCollapsed()"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M9 3v18" />
                      <path d="m14 9 3 3-3 3" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Expand sidebar</TooltipContent>
              </Tooltip>
            </div>

            <!-- Navigation Menu -->
            <div class="flex-1 overflow-y-auto py-2">
              <NavPanel :collapsed="ui.isSidebarCollapsed" />
            </div>
          </aside>

          <!-- Mobile Sidebar Overlay -->
          <div
            v-if="auth.isAuthenticated && ui.isSidebarVisible"
            class="fixed inset-0 z-30 bg-black/50 md:hidden"
            @click="ui.setSidebarVisible(false)"
          />

          <!-- Mobile Sidebar -->
          <aside
            v-if="auth.isAuthenticated && ui.isSidebarVisible"
            :class="[
              ...sidebarClasses,
              'fixed inset-y-0 left-0 z-40 md:hidden',
              ui.isSidebarVisible ? 'translate-x-0' : '-translate-x-full',
            ]"
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
              <router-link to="/" class="flex items-center gap-2">
                <span class="text-lg font-bold text-sidebar-foreground">Wenyan</span>
              </router-link>
              <Button variant="ghost" size="sm" class="p-1.5" @click="ui.setSidebarVisible(false)">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </Button>
            </div>
            <div class="flex-1 overflow-y-auto py-2">
              <NavPanel :collapsed="ui.isSidebarCollapsed" />
            </div>
          </aside>

          <!-- Unified Scrollable Content Area -->
          <div class="flex flex-1 overflow-y-auto">
            <!-- Left Rail -->
            <div v-if="auth.isAuthenticated && ui.isLeftRailVisible" :class="leftRailClasses">
              <!-- Toggle Sidebar Button -->
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="p-1.5 mb-2"
                    @click="ui.toggleSidebarVisibility()"
                  >
                    <svg
                      v-if="ui.isSidebarVisible"
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M9 3v18" />
                      <path d="m10 9-3 3 3 3" />
                    </svg>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M9 3v18" />
                      <path d="m14 9 3 3-3 3" />
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {{ ui.isSidebarVisible ? "Hide sidebar" : "Show sidebar" }}
                </TooltipContent>
              </Tooltip>
            </div>

            <!-- Main Content Area -->
            <main class="flex-1 min-w-0 pr-4">
              <router-view @click="closeSidebarOnMobile" />
            </main>

            <!-- Right Rail (reserved for future use) -->
            <div v-if="auth.isAuthenticated && ui.isRightRailVisible" :class="rightRailClasses">
              <!-- Right rail content can go here -->
            </div>
          </div>
        </div>
      </AuthGuard>
    </div>
    <Toaster />
  </TooltipProvider>
</template>

<style scoped>
/* Smooth transitions */
aside,
.rail {
  will-change: transform, width;
}

/* Mobile optimizations */
@media (max-width: 767px) {
  aside {
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
  }
}
</style>
