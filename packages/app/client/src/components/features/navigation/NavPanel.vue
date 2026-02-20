<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue"
import { useRoute } from "vue-router"
import { Icon } from "@iconify/vue"
import { useAuthStore } from "@/auth"
import { useNavigationMenu } from "./useNavigationMenu"
import { useNavPanel } from "./composables/useNavPanel"
import { useThemePreference } from "@/composables/useThemePreference"
import NavItem from "./components/NavItem.vue"


const props = defineProps<{ collapsed: boolean }>()

const { menus, isReady } = useNavigationMenu()
const auth = useAuthStore()
const route = useRoute()
const { colorMode, setThemeMode: setUserThemeMode } = useThemePreference()
const { expandActiveParents } = useNavPanel()

// Debug mode for showing gate codes
const showMenuGates = ref(false)
const canViewDebugOutput = computed(() => auth.hasPermission("view_debug_output"))

// Expand parents with active children on mount and when route changes
watch(
  () => route.path,
  () => {
    if (isReady.value) {
      menus.value.forEach((menu) => expandActiveParents(menu.menuItems))
    }
  },
  { immediate: true },
)

watch(isReady, (ready) => {
  if (ready) {
    menus.value.forEach((menu) => expandActiveParents(menu.menuItems))
  }
})

// User menu state
const isUserMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)


// Close dropdowns when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    isUserMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside)
})

// Cleanup
onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside)
})

// Get user initials
const userInitials = computed(() => {
  const name = auth.user?.name?.trim() || ""
  if (!name) return "?"
  return name
    .split(/\s+/)
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
})

const isAdmin = computed(() =>
  auth.hasPermission("configure_application"),
)

async function handleSignOut() {
  isUserMenuOpen.value = false
  try {
    await auth.signOut()
  } catch (e) {
    console.error("Sign out failed:", e)
  }
}

// Theme handling with dropdown
// Map VueUse's 'auto' to our UI's 'system'
const currentTheme = computed(() => {
  const mode = colorMode.store.value
  return mode === "auto" ? "system" : mode
})

const setTheme = (theme: "light" | "dark" | "system") => {
  setUserThemeMode(theme)
}

const currentThemeIcon = computed(() => {
  if (currentTheme.value === "light") return "heroicons:sun"
  if (currentTheme.value === "dark") return "heroicons:moon"
  return "heroicons:computer-desktop"
})

const themeOrder = ["light", "dark", "system"] as const

const cycleTheme = () => {
  const index = themeOrder.indexOf(currentTheme.value)
  const next = themeOrder[(index + 1) % themeOrder.length]
  setTheme(next)
}

const activeMenuIndex = ref(0)
const hasMultipleMenus = computed(() => menus.value.length > 1)
const prismAngle = computed(() => {
  const count = Math.max(menus.value.length, 1)
  return 360 / count
})
const prismDepth = computed(() => {
  const count = Math.max(menus.value.length, 1)
  return count <= 1 ? 0 : 240
})

watch(
  () => menus.value.length,
  (count) => {
    if (activeMenuIndex.value >= count) {
      activeMenuIndex.value = 0
    }
  },
)

const prismStyle = computed(() => ({
  transform: `translateZ(-${prismDepth.value}px) rotateY(-${activeMenuIndex.value * prismAngle.value}deg)`,
}))

const faceStyle = (index: number) => ({
  transform: `rotateY(${index * prismAngle.value}deg) translateZ(${prismDepth.value}px)`,
})

const nextMenu = () => {
  if (!hasMultipleMenus.value) return
  activeMenuIndex.value = (activeMenuIndex.value + 1) % menus.value.length
}

const prevMenu = () => {
  if (!hasMultipleMenus.value) return
  activeMenuIndex.value =
    (activeMenuIndex.value - 1 + menus.value.length) % menus.value.length
}

// Toggle debug mode
const toggleMenuGatesFn = () => {
  showMenuGates.value = !showMenuGates.value
}
</script>

<template>
  <div class="flex h-full flex-col p-2">
    <!-- Scrollable menu area -->
    <div class="nav-scroll flex-1 overflow-hidden p-2">
      <!-- Loading skeleton -->
      <template v-if="!isReady">
        <div class="flex flex-col gap-3 p-2">
          <div class="h-5 w-3/4 rounded bg-muted animate-pulse" />
          <div class="h-5 w-[83%] rounded bg-muted animate-pulse" />
          <div class="h-5 w-2/3 rounded bg-muted animate-pulse" />
          <div class="h-5 w-1/2 rounded bg-muted animate-pulse" />
        </div>
      </template>

      <!-- Menu items -->
      <div v-else class="relative h-full">
        <div v-if="hasMultipleMenus" class="mb-3 flex items-center justify-between px-1">
          <button type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            @click="prevMenu" aria-label="Previous menu">
            <Icon icon="heroicons:chevron-left" class="h-4 w-4" />
          </button>
          <div class="text-xs text-muted-foreground">
            {{ menus[activeMenuIndex]?.name ?? "Menu" }}
          </div>
          <button type="button"
            class="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            @click="nextMenu" aria-label="Next menu">
            <Icon icon="heroicons:chevron-right" class="h-4 w-4" />
          </button>
        </div>

        <div class="nav-prism">
          <div class="nav-prism__scene">
            <div class="nav-prism__prism" :style="prismStyle">
              <section v-for="(menu, menuIndex) in menus" :key="menu.name || menuIndex" class="nav-prism__face"
                :style="faceStyle(menuIndex)" role="navigation" :aria-label="menu.name">
                <nav class="flex flex-col gap-1 overflow-y-auto overflow-x-hidden pr-1">
                  <NavItem v-for="(item, index) in menu.menuItems" :key="item.to || item.label || index" :item="item"
                    :level="0" :collapsed="collapsed" :show-gates="showMenuGates" />
                </nav>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Debug toggle (only if permission) -->
    <div v-if="canViewDebugOutput && !collapsed" class="border-t border-border px-3 py-2">
      <div class="flex items-center gap-2">
        <button type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="toggleMenuGatesFn" aria-label="Toggle gates">
          <Icon icon="heroicons:shield-check" class="w-4 h-4" />
        </button>
        <button type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="cycleTheme" aria-label="Cycle theme mode">
          <Icon :icon="currentThemeIcon" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Bottom section: Theme & User -->
    <div class="flex flex-col gap-2 border-t border-border p-3">

      <!-- User menu -->
      <div ref="userMenuRef" class="relative">
        <button id="user-menu-toggle" type="button" :class="[
          'flex w-full items-center gap-3 rounded-lg border border-transparent bg-transparent p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
          { 'mx-auto h-10 w-10 justify-center p-1': collapsed },
        ]" @click="isUserMenuOpen = !isUserMenuOpen" aria-haspopup="menu" :aria-expanded="isUserMenuOpen"
          aria-controls="user-menu">
          <!-- Avatar -->
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {{ userInitials }}
          </div>

          <!-- User info (expanded) -->
          <template v-if="!collapsed">
            <div class="flex-1 min-w-0 text-left">
              <p class="truncate text-sm font-medium text-foreground">{{ auth.user?.name }}</p>
              <p class="truncate text-xs text-muted-foreground">{{ auth.user?.email }}</p>
            </div>
            <Icon icon="heroicons:chevron-down" class="h-4 w-4 shrink-0 text-muted-foreground transition-transform"
              :class="{ 'rotate-180': isUserMenuOpen }" />
          </template>
        </button>

        <!-- Dropdown menu -->
        <Transition enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95 -translate-y-2" enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 -translate-y-2">
          <div v-if="isUserMenuOpen" id="user-menu" :class="[
            'absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-lg border border-border bg-popover shadow-lg',
            { 'left-full right-auto top-0 bottom-auto mb-0 ml-2 w-56': collapsed },
          ]" role="menu" aria-labelledby="user-menu-toggle">
            <!-- User header -->
            <div class="border-b border-border bg-muted px-4 py-3">
              <p class="truncate text-sm font-medium text-foreground">{{ auth.user?.name }}</p>
              <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ auth.user?.email }}</p>
            </div>

            <!-- Menu items -->
            <div class="p-1">
              <router-link to="/user/user-settings"
                class="flex w-full items-center gap-3 rounded-md bg-transparent px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                role="menuitem" @click="isUserMenuOpen = false">
                <Icon icon="heroicons:cog-6-tooth" class="w-4 h-4" />
                <span>Settings</span>
              </router-link>

              <router-link v-if="isAdmin" to="/admin"
                class="flex w-full items-center gap-3 rounded-md bg-transparent px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                role="menuitem" @click="isUserMenuOpen = false">
                <Icon icon="heroicons:shield-check" class="w-4 h-4" />
                <span>Admin</span>
              </router-link>
            </div>

            <!-- Sign out -->
            <div class="border-t border-border p-1">
              <button type="button"
                class="flex w-full items-center gap-3 rounded-md bg-transparent px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                role="menuitem" @click="handleSignOut">
                <Icon icon="heroicons:arrow-right-on-rectangle" class="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nav-prism {
  position: relative;
  height: 100%;
  width: 100%;
  perspective: 1000px;
}

.nav-prism__scene {
  position: relative;
  height: 100%;
  width: 100%;
  transform-style: preserve-3d;
}

.nav-prism__prism {
  position: relative;
  height: 100%;
  width: 100%;
  transform-style: preserve-3d;
  transition: transform 700ms cubic-bezier(0.25, 0.8, 0.25, 1);
}

.nav-prism__face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  transform-style: preserve-3d;
  display: flex;
}

.nav-prism__face nav {
  width: 100%;
}
</style>
