<script setup lang="ts">
import { Badge } from "@/components/ui/badge"

defineProps<{
  label: string
}>()
</script>

<template>
  <Badge variant="soft" color="secondary" class="text-[11px]">
    {{ label }}
  </Badge>
</template>
