<script setup lang="ts">
import { computed } from "vue"
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import Button from "@/components/ui/button/Button.vue"

const props = defineProps<{
  page: number
  pageSize: number
  total: number
  class?: HTMLAttributes["class"]
}>()

const emit = defineEmits<{
  (e: "update:page", value: number): void
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const isFirst = computed(() => props.page <= 1)
const isLast = computed(() => props.page >= totalPages.value)

const goTo = (value: number) => {
  const next = Math.min(Math.max(1, value), totalPages.value)
  if (next !== props.page) {
    emit("update:page", next)
  }
}
</script>

<template>
  <div :class="cn('flex items-center gap-2', props.class)">
    <Button variant="outline" size="sm" :disabled="isFirst" @click="goTo(props.page - 1)">
      Prev
    </Button>
    <div class="text-sm text-muted-foreground">
      Page {{ props.page }} of {{ totalPages }}
    </div>
    <Button variant="outline" size="sm" :disabled="isLast" @click="goTo(props.page + 1)">
      Next
    </Button>
  </div>
</template>
