<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import type { SemanticColor } from "@wenyan/shared";
import type { ButtonVariants } from ".";
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";
import { buttonVariants } from ".";

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"];
  color?: SemanticColor;
  size?: ButtonVariants["size"];
  class?: HTMLAttributes["class"];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  variant: "solid",
  color: "primary",
});

import { useAttrs, computed } from "vue";
const attrs = useAttrs();
const isLoading = computed(() => !!props.loading);
const effectiveDisabled = computed(() => {
  const a = attrs as Record<string, any>;
  return props.loading ? true : !!a.disabled;
});
const computedClass = computed(() =>
  cn(
    buttonVariants({ variant: props.variant, color: props.color, size: props.size }),
    props.class,
    effectiveDisabled.value ? "" : "cursor-pointer",
  ),
);
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="computedClass"
    :disabled="effectiveDisabled"
    :aria-busy="isLoading ? 'true' : undefined"
  >
    <span v-if="isLoading" class="inline-flex items-center">
      <svg
        class="animate-spin -ml-1 mr-2 h-4 w-4 text-primary"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        ></path>
      </svg>
      <slot />
    </span>
    <template v-else>
      <slot />
    </template>
  </Primitive>
</template>
