<template>
  <div class="flex flex-col space-y-1">
    <span class="text-sm text-muted-foreground">{{ label }}</span>
    <span class="font-medium">{{ value || '-' }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value?: string | null
}>()
</script>
