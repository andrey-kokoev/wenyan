import { computed } from "vue"
import { useAuthStore } from "@/auth"
import { baseMenu, devMenu, appAdminMenu, tenantAdminMenu, appearanceMenu } from "./baseMenu"
import type { AppMenuItem, NavigationMenu } from "./types"

// Menu cache buster: 2026-02-02T13:00:00Z

function filterMenu(items: AppMenuItem[], can: (action: string) => boolean): AppMenuItem[] {
  return items
    .filter((item) => !item.requiredAbility || can(item.requiredAbility))
    .map((item) => ({
      ...item,
      children: item.children ? filterMenu(item.children, can) : undefined,
    }))
}

function filterMenus(menus: NavigationMenu[], can: (action: string) => boolean): NavigationMenu[] {
  return menus
    .filter((menu) => !menu.requiredAbility || can(menu.requiredAbility))
    .map((menu) => ({
      ...menu,
      menuItems: filterMenu(menu.menuItems, can),
    }))
    .filter((menu) => menu.menuItems.length > 0)
}

export function useNavigationMenu() {
  const auth = useAuthStore()

  const can = (action: string) => auth.hasPermission(action)

  // Gate menu rendering until auth is ready to avoid early permission checks
  const isReady = computed(() => !auth.loading)

  const menus = computed<NavigationMenu[]>(() => {
    if (!isReady.value) return []
    return filterMenus([baseMenu, appearanceMenu, appAdminMenu, tenantAdminMenu, devMenu], can)
  })

  return { menus, isReady }
}
