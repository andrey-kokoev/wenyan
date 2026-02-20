import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Skeleton } from "./Skeleton.vue"

export const skeletonVariants = cva(
  "animate-pulse bg-muted rounded",
  {
    variants: {
      size: {
        "default": "",
        "xs": "h-3",
        "sm": "h-4",
        "md": "h-5",
        "lg": "h-6",
        "xl": "h-7",
      },
      width: {
        "default": "",
        "1/4": "w-1/4",
        "1/3": "w-1/3",
        "1/2": "w-1/2",
        "2/3": "w-2/3",
        "3/4": "w-3/4",
        "full": "w-full",
      },
    },
    defaultVariants: {
      size: "default",
      width: "default",
    },
  },
)

export type SkeletonVariants = VariantProps<typeof skeletonVariants>
