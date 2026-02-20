<script setup lang="ts">
import { computed } from "vue"
import { Icon } from "@iconify/vue"
import type { ThemeMode } from "@wenyan/shared"
import { Button } from "@/components/ui/button"
import { useThemePreference } from "@/composables/useThemePreference"

const { setThemeMode } = useThemePreference()

const props = defineProps<{
  mode: ThemeMode
}>()

const order: ThemeMode[] = ["light", "dark", "system"]

const nextMode = computed<ThemeMode>(() => {
  const index = order.indexOf(props.mode)
  if (index === -1) return "system"
  return order[(index + 1) % order.length]
})

const label = computed(() => {
  if (props.mode === "light") return "Light"
  if (props.mode === "dark") return "Dark"
  return "System"
})

const iconName = computed(() => {
  if (props.mode === "light") return "heroicons:sun"
  if (props.mode === "dark") return "heroicons:moon"
  return "heroicons:computer-desktop"
})

const handleClick = async () => {
  await setThemeMode(nextMode.value)
}
</script>

<template>
  <Button
    variant="link"
    size="sm"
    class="flex items-center gap-2 cursor-pointer"
    @click="handleClick"
  >
    <Icon :icon="iconName" class="h-4 w-4" />
    <span>{{ label }}</span>
  </Button>
</template>
