import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export const navigationMenuVariants = cva(
  "",
  {
    variants: {
      orientation: {
        vertical: "flex flex-col h-full",
        horizontal: "flex flex-row",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  },
)

export type NavigationMenuVariants = VariantProps<typeof navigationMenuVariants>

export const navigationMenuTriggerStyle = () => ""