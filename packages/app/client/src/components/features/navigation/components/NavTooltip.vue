<template>
  <div class="nav-tooltip-wrapper" @mouseenter="show" @mouseleave="hide">
    <slot />
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-x-1"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 translate-x-1"
    >
      <div
        v-if="isVisible"
        class="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-md shadow-lg border border-border whitespace-nowrap z-50"
        role="tooltip"
      >
        <div class="font-medium">{{ label }}</div>
        <div v-if="description" class="text-xs text-muted-foreground mt-0.5">
          {{ description }}
        </div>
        <!-- Arrow -->
        <div
          class="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-popover border-l border-b border-border rotate-45"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"

interface Props {
  label: string
  description?: string
  delay?: number
}

const props = withDefaults(defineProps<Props>(), {
  delay: 200,
})

const isVisible = ref(false)
let timeoutId: ReturnType<typeof setTimeout> | null = null

const show = () => {
  if (timeoutId) clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    isVisible.value = true
  }, props.delay)
}

const hide = () => {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  isVisible.value = false
}
</script>

<style scoped>
.nav-tooltip-wrapper {
  position: relative;
  display: inline-flex;
}
</style>
