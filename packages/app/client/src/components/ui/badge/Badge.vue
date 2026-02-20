<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { SEMANTIC_COLORS, type SemanticColor } from "@wenyan/shared"
import type { BadgeVariants } from "."
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"
import { badgeVariants } from "."

interface Props extends PrimitiveProps {
  variant?: BadgeVariants["variant"]
  color?: SemanticColor
  size?: BadgeVariants["size"]
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "span",
  variant: "default",
  color: "primary",
  size: "default",
})

const normalizeColor = (value: SemanticColor | undefined): SemanticColor => {
  if (value && SEMANTIC_COLORS.includes(value)) {
    return value
  }
  return "primary"
}
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="cn(badgeVariants({ variant, color: normalizeColor(props.color), size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
