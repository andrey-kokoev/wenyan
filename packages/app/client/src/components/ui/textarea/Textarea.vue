<template>
  <textarea
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    class="flex min-h-[80px] w-full rounded-md border border-input bg-inset px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
    :class="$attrs.class"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>
