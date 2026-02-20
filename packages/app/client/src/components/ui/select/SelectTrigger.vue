<script setup lang="ts">
import type { SelectTriggerProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { SelectIcon, SelectTrigger, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/vue";

const props = defineProps<
  SelectTriggerProps & { class?: HTMLAttributes["class"] }
>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <SelectTrigger
    v-bind="forwardedProps"
    :class="
      cn(
        'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-inset px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
        props.class
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
    </SelectIcon>
  </SelectTrigger>
</template>
