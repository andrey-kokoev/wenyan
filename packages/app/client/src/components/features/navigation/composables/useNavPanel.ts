import { ref, computed } from "vue"
import { useRoute } from "vue-router"
import type { AppMenuItem } from "../types"

export interface MenuItemWithState extends AppMenuItem {
  isExpanded?: boolean
  level: number
  parentExpanded?: boolean
}

export function useNavPanel() {
  const route = useRoute()

  // Track expanded parent items by their label/path
  const expandedItems = ref<string[]>([])

  // Check if a route is active (exact match only for leaf items)
  const isActiveRoute = (to?: string, item?: AppMenuItem): boolean => {
    if (!to) return false
    // Exact match always works
    if (route.path === to) return true
    // Only match as parent if the item actually has children
    // This prevents "/access-control" from matching when on "/access-control/roles"
    if (item?.children && item.children.length > 0) {
      return route.path.startsWith(to + "/")
    }
    return false
  }

  // Check if any child of a parent is active
  const isParentActive = (item: AppMenuItem): boolean => {
    if (!item.children?.length) return false
    return item.children.some((child) => isActiveRoute(child.to))
  }

  // Check if an item should be auto-expanded (has active child)
  const shouldAutoExpand = (item: AppMenuItem): boolean => {
    if (!item.children?.length) return false
    return isParentActive(item)
  }

  // Toggle expansion state
  const toggleExpand = (key: string) => {
    if (expandedItems.value.includes(key)) {
      expandedItems.value = expandedItems.value.filter((value) => value !== key)
      return
    }
    expandedItems.value = [...expandedItems.value, key]
  }

  // Expand an item
  const expandItem = (key: string) => {
    if (!expandedItems.value.includes(key)) {
      expandedItems.value = [...expandedItems.value, key]
    }
  }

  // Collapse an item
  const collapseItem = (key: string) => {
    expandedItems.value = expandedItems.value.filter((value) => value !== key)
  }

  // Check if item is expanded
  const isExpanded = (key: string): boolean => {
    return expandedItems.value.includes(key)
  }

  // Collapse all items
  const collapseAll = () => {
    expandedItems.value = []
  }

  // Expand all items that have active children
  const expandActiveParents = (items: AppMenuItem[]) => {
    items.forEach((item) => {
      if (shouldAutoExpand(item)) {
        expandItem(item.label)
      }
      if (item.children) {
        expandActiveParents(item.children)
      }
    })
  }

  return {
    // State
    expandedItems: computed(() => expandedItems.value),

    // Actions
    toggleExpand,
    expandItem,
    collapseItem,
    isExpanded,
    collapseAll,
    expandActiveParents,

    // Helpers
    isActiveRoute,
    isParentActive,
    shouldAutoExpand,
  }
}
