<template>
  <div class="nav-item-wrapper" :style="{ '--level': level }">
    <!-- Parent item with children -->
    <template v-if="item.children && item.children.length > 0">
      <!-- Collapsed mode: Show flyout on hover -->
      <template v-if="collapsed">
        <NavTooltip :label="item.label" :description="item.description">
          <button
            type="button"
            :class="[
              'nav-item nav-item-parent nav-item-collapsed',
              {
                'nav-item-active': isItemParentActive,
                'nav-item-expanded': isExpanded(item.label),
              },
            ]"
            @click="toggleExpand(item.label)"
            @keydown.enter="toggleExpand(item.label)"
            @keydown.space.prevent="toggleExpand(item.label)"
          >
            <Icon
              v-if="item.icon"
              :icon="item.icon"
              class="nav-item-icon"
            />
            <span v-if="item.badge" class="nav-item-badge">
              {{ typeof item.badge === 'string' || typeof item.badge === 'number' ? item.badge : item.badge.label }}
            </span>
          </button>
        </NavTooltip>

        <!-- Flyout menu for collapsed mode -->
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95 -translate-x-2"
          enter-to-class="opacity-100 scale-100 translate-x-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100 translate-x-0"
          leave-to-class="opacity-0 scale-95 -translate-x-2"
        >
          <div
            v-if="isExpanded(item.label)"
            class="nav-flyout"
          >
            <div class="nav-flyout-header">
              <Icon v-if="item.icon" :icon="item.icon" class="w-4 h-4" />
              <span>{{ item.label }}</span>
            </div>
            <div class="nav-flyout-content">
              <NavItem
                v-for="(child, index) in item.children"
                :key="child.to || child.label || index"
                :item="child"
                :level="level + 1"
                :collapsed="false"
                @navigate="$emit('navigate', $event)"
              />
            </div>
          </div>
        </Transition>
      </template>

      <!-- Expanded mode: Accordion -->
      <template v-else>
        <button
          type="button"
          :class="[
            'nav-item nav-item-parent',
            {
              'nav-item-active': isItemParentActive,
              'nav-item-expanded': isExpanded(item.label),
            },
          ]"
          @click="toggleExpand(item.label)"
          @keydown.enter="toggleExpand(item.label)"
          @keydown.space.prevent="toggleExpand(item.label)"
        >
          <Icon
            v-if="item.icon"
            :icon="item.icon"
            class="nav-item-icon"
          />
          <span class="nav-item-label">{{ item.label }}</span>
          <Icon
            icon="heroicons:chevron-down"
            class="nav-item-chevron"
            :class="{ 'rotate-180': isExpanded(item.label) }"
          />
          <span v-if="item.badge" class="nav-item-badge">
            {{ typeof item.badge === 'string' || typeof item.badge === 'number' ? item.badge : item.badge.label }}
          </span>
        </button>

        <!-- Children container with animation -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-96"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 max-h-96"
          leave-to-class="opacity-0 max-h-0"
        >
          <div
            v-if="isExpanded(item.label)"
            class="nav-children"
            role="group"
            :aria-label="item.label + ' submenu'"
          >
            <NavItem
              v-for="(child, index) in item.children"
              :key="child.to || child.label || index"
              :item="child"
              :level="level + 1"
              :collapsed="collapsed"
              @navigate="$emit('navigate', $event)"
            />
          </div>
        </Transition>
      </template>
    </template>

    <!-- Single item (leaf node) -->
    <template v-else>
      <!-- Collapsed mode: Tooltip -->
      <NavTooltip
        v-if="collapsed"
        :label="item.label"
        :description="item.description"
      >
        <router-link
          v-if="item.to"
          :to="item.to"
          :class="[
            'nav-item nav-item-link nav-item-collapsed',
            { 'nav-item-active': isItemActive },
          ]"
          @click="handleNavigate"
        >
          <Icon
            v-if="item.icon"
            :icon="item.icon"
            class="nav-item-icon"
          />
          <span v-if="item.badge" class="nav-item-badge">
            {{ typeof item.badge === 'string' || typeof item.badge === 'number' ? item.badge : item.badge.label }}
          </span>
        </router-link>
        <span
          v-else
          :class="[
            'nav-item nav-item-disabled nav-item-collapsed',
          ]"
        >
          <Icon
            v-if="item.icon"
            :icon="item.icon"
            class="nav-item-icon"
          />
        </span>
      </NavTooltip>

      <!-- Expanded mode: Regular link -->
      <template v-else>
        <router-link
          v-if="item.to"
          :to="item.to"
          :class="[
            'nav-item nav-item-link',
            { 'nav-item-active': isItemActive },
          ]"
          @click="handleNavigate"
        >
          <Icon
            v-if="item.icon"
            :icon="item.icon"
            class="nav-item-icon"
          />
          <span class="nav-item-label">{{ item.label }}</span>
          <span v-if="item.badge" class="nav-item-badge">
            {{ typeof item.badge === 'string' || typeof item.badge === 'number' ? item.badge : item.badge.label }}
          </span>
        </router-link>
        <span
          v-else
          class="nav-item nav-item-disabled"
        >
          <Icon
            v-if="item.icon"
            :icon="item.icon"
            class="nav-item-icon"
          />
          <span class="nav-item-label">{{ item.label }}</span>
        </span>
      </template>
    </template>

    <!-- Gate codes debug display -->
    <template v-if="showGates && gateCodes.length > 0 && !collapsed">
      <div class="nav-gates">
        <span
          v-for="code in gateCodes"
          :key="code"
          class="nav-gate-tag"
        >
          {{ code }}
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Icon } from "@iconify/vue"
import type { AppMenuItem } from "../types"
import { useNavPanel } from "../composables/useNavPanel"
import NavTooltip from "./NavTooltip.vue"

interface Props {
  item: AppMenuItem
  level?: number
  collapsed?: boolean
  showGates?: boolean
  parentGates?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  level: 0,
  collapsed: false,
  showGates: false,
  parentGates: () => [],
})

const emit = defineEmits<{
  navigate: [item: AppMenuItem]
}>()

const {
  isActiveRoute,
  isParentActive,
  isExpanded,
  toggleExpand,
} = useNavPanel()

// Cache active route check for performance
const isItemActive = computed(() => isActiveRoute(props.item.to, props.item))
const isItemParentActive = computed(() => isParentActive(props.item))

// Calculate gate codes for this item - memoized for performance
const gateCodes = computed(() => {
  // Skip computation if no gates to show
  if (!props.showGates) return []
  if (props.parentGates.length === 0 && !props.item.requiredAbility) return []
  
  // Use array deduplication for small sets (faster than Set for < 10 items)
  const codes: string[] = [...props.parentGates]
  
  if (props.item.requiredAbility && !props.parentGates.includes(props.item.requiredAbility)) {
    codes.push(props.item.requiredAbility)
  }
  
  return codes
})

const handleNavigate = () => {
  emit("navigate", props.item)
}
</script>

<style scoped>
/* Base styles */
.nav-item-wrapper {
  position: relative;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease;
  text-decoration: none;
  cursor: pointer;
  border: none;
  border-left: 3px solid transparent;
  background: transparent;
  color: var(--foreground);
  text-align: left;
}

.nav-item:hover {
  background-color: var(--accent);
  color: var(--accent-foreground);
}

.nav-item:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: -2px;
}

/* Active state - only changes border color, not size */
.nav-item-active {
  background-color: var(--accent);
  color: var(--accent-foreground);
  border-left-color: var(--primary);
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

/* Parent item styles */
.nav-item-parent {
  font-weight: 600;
}

.nav-item-expanded {
  background-color: var(--accent);
}

/* Collapsed mode */
.nav-item-collapsed {
  justify-content: center;
  padding: 0.5rem;
  min-height: 2.5rem;
  width: 2.5rem;
  margin: 0 auto;
}

/* Icon */
.nav-item-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

/* Label */
.nav-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Chevron */
.nav-item-chevron {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  transition: transform 200ms ease;
}

/* Badge */
.nav-item-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 600;
  background-color: var(--primary);
  color: var(--primary-foreground);
}

/* Disabled state */
.nav-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Children container */
.nav-children {
  margin-left: calc(var(--level, 0) * 0.75rem + 0.75rem);
  padding-left: 0.5rem;
  border-left: 1px solid var(--border);
  overflow: hidden;
}

/* Flyout menu (collapsed mode) */
.nav-flyout {
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 0.5rem;
  min-width: 200px;
  background-color: var(--popover);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  z-index: 50;
  overflow: hidden;
}

.nav-flyout-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-weight: 600;
  font-size: 0.875rem;
  border-bottom: 1px solid var(--border);
  background-color: var(--muted);
  color: var(--muted-foreground);
}

.nav-flyout-content {
  padding: 0.5rem;
}

/* Gate codes */
.nav-gates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.25rem;
  margin-left: calc(1.25rem + 0.75rem);
  padding-left: 0.5rem;
}

.nav-gate-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  background-color: var(--muted);
  color: var(--muted-foreground);
  border: 1px solid var(--border);
}
</style>
