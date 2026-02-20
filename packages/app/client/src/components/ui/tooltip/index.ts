import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Tooltip } from "./Tooltip.vue"
export { default as TooltipContent } from "./TooltipContent.vue"
export { default as TooltipProvider } from "./TooltipProvider.vue"
export { default as TooltipTrigger } from "./TooltipTrigger.vue"

export const tooltipVariants = cva(
  "pointer-events-none absolute z-50",
  {
    variants: {
      variant: {
        default: "translate-x-1/2 -translate-y-3 bg-background text-foreground rounded-lg border border-input shadow-lg p-2 text-xs",
        error: "translate-x-1/2 -translate-y-3 bg-error text-error-foreground rounded-lg border border-input shadow-lg p-2 text-xs",
        success: "translate-x-1/2 -translate-y-3 bg-success text-success-foreground rounded-lg border border-input shadow-lg p-2 text-xs",
        warning: "translate-x-1/2 -translate-y-3 bg-warning text-warning-foreground rounded-lg border border-input shadow-lg p-2 text-xs",
        info: "translate-x-1/2 -translate-y-3 bg-info text-info-foreground rounded-lg border border-input shadow-lg p-2 text-xs",
      },
      size: {
        "default": "",
        "sm": "p-1 text-2xs",
        "lg": "p-3 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export type TooltipVariants = VariantProps<typeof tooltipVariants>
