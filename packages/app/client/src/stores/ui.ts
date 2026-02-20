import { ref, computed } from "vue"
import { defineStore } from "pinia"

export type LayoutContainer = "main" | "primarySideBar" | "leftRail" | "rightRail" | "secondarySideBar" | "bottomPanel"

export const useUiStore = defineStore("ui", () => {
  // State - Layout container visibility
  const visibleContainers = ref<LayoutContainer[]>([
    "main",
    "primarySideBar", 
    "leftRail",
    "rightRail",
  ])
  
  // Sidebar state
  const isSidebarCollapsed = ref(false)
  
  // Computed - Container visibility
  const isContainerVisible = computed(() => (name: LayoutContainer) => 
    visibleContainers.value.includes(name)
  )
  
  const isSidebarVisible = computed(() => 
    visibleContainers.value.includes("primarySideBar")
  )
  
  const isLeftRailVisible = computed(() =>
    visibleContainers.value.includes("leftRail")
  )
  
  const isRightRailVisible = computed(() =>
    visibleContainers.value.includes("rightRail")
  )
  
  // Computed - Dimensions
  const sidebarWidth = computed(() => (isSidebarCollapsed.value ? "w-16" : "w-64"))
  const sidebarWidthClass = computed(() => sidebarWidth.value)
  
  const railWidth = computed(() => "w-10")
  const railWidthClass = computed(() => railWidth.value)
  
  // Actions - Container visibility
  function toggleContainer(name: LayoutContainer) {
    const index = visibleContainers.value.indexOf(name)
    if (index === -1) {
      visibleContainers.value.push(name)
    } else {
      visibleContainers.value.splice(index, 1)
    }
  }
  
  function showContainer(name: LayoutContainer) {
    if (!visibleContainers.value.includes(name)) {
      visibleContainers.value.push(name)
    }
  }
  
  function hideContainer(name: LayoutContainer) {
    const index = visibleContainers.value.indexOf(name)
    if (index !== -1) {
      visibleContainers.value.splice(index, 1)
    }
  }
  
  // Actions - Sidebar
  function toggleSidebarVisibility() {
    toggleContainer("primarySideBar")
  }
  
  function toggleSidebarCollapsed() {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }
  
  function setSidebarVisible(visible: boolean) {
    if (visible) {
      showContainer("primarySideBar")
    } else {
      hideContainer("primarySideBar")
    }
  }
  
  function setSidebarCollapsed(collapsed: boolean) {
    isSidebarCollapsed.value = collapsed
  }
  
  // Actions - Rails
  function toggleLeftRail() {
    toggleContainer("leftRail")
  }
  
  function toggleRightRail() {
    toggleContainer("rightRail")
  }

  return {
    // State
    visibleContainers,
    isSidebarCollapsed,
    // Computed
    isContainerVisible,
    isSidebarVisible,
    isLeftRailVisible,
    isRightRailVisible,
    sidebarWidth,
    sidebarWidthClass,
    railWidth,
    railWidthClass,
    // Actions
    toggleContainer,
    showContainer,
    hideContainer,
    toggleSidebarVisibility,
    toggleSidebarCollapsed,
    setSidebarVisible,
    setSidebarCollapsed,
    toggleLeftRail,
    toggleRightRail,
  }
})
