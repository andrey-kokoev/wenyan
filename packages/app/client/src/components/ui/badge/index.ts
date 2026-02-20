import type { SemanticColor } from "@wenyan/shared"
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Badge } from "./Badge.vue"

/**
 * Badge component with variants matching Button component styling.
 *
 * @variant default - Filled background (default)
 * @variant outline - Ring border with transparent background
 * @variant soft - Tinted background without border
 * @variant subtle - Tinted background with ring border
 * @variant ghost - Transparent, shows background only on hover
 *
 * @colors primary, secondary, success, warning, error, info, neutral
 * @sizes default, sm, lg
 */
export const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
  {
    variants: {
      variant: {
        default: "border-transparent",
        outline: "ring-1 ring-inset bg-transparent",
        soft: "border-transparent",
        subtle: "ring-1 ring-inset",
        ghost: "border-transparent hover:bg-accent hover:text-accent-foreground",
      },
      color: ({
        primary: "",
        secondary: "",
        success: "",
        warning: "",
        error: "",
        info: "",
        neutral: "",
      } as Record<SemanticColor, string>),
      size: {
        default: "px-2.5 py-0.5",
        sm: "px-2 py-0.5 text-[0.75rem]",
        lg: "px-3 py-0.5 text-sm",
      },
    },
    compoundVariants: [
      // Default variants with colors
      { variant: "default", color: "primary", class: "bg-primary text-primary-foreground" },
      { variant: "default", color: "secondary", class: "bg-secondary text-secondary-foreground" },
      { variant: "default", color: "success", class: "bg-success text-success-foreground" },
      { variant: "default", color: "warning", class: "bg-warning text-warning-foreground" },
      { variant: "default", color: "error", class: "bg-destructive text-destructive-foreground" },
      { variant: "default", color: "info", class: "bg-info text-info-foreground" },
      { variant: "default", color: "neutral", class: "bg-neutral text-neutral-foreground" },
      // Outline variants with colors
      { variant: "outline", color: "primary", class: "ring-primary/50 text-primary" },
      { variant: "outline", color: "secondary", class: "ring-secondary/50 text-secondary" },
      { variant: "outline", color: "success", class: "ring-success/50 text-success" },
      { variant: "outline", color: "warning", class: "ring-warning/50 text-warning" },
      { variant: "outline", color: "error", class: "ring-destructive/50 text-destructive" },
      { variant: "outline", color: "info", class: "ring-info/50 text-info" },
      { variant: "outline", color: "neutral", class: "ring-neutral/50 text-neutral" },
      // Soft variants with colors
      { variant: "soft", color: "primary", class: "bg-primary/10 text-primary" },
      { variant: "soft", color: "secondary", class: "bg-secondary/10 text-secondary" },
      { variant: "soft", color: "success", class: "bg-success/10 text-success" },
      { variant: "soft", color: "warning", class: "bg-warning/10 text-warning" },
      { variant: "soft", color: "error", class: "bg-destructive/10 text-destructive" },
      { variant: "soft", color: "info", class: "bg-info/10 text-info" },
      { variant: "soft", color: "neutral", class: "bg-neutral/10 text-neutral" },
      // Subtle variants with colors
      { variant: "subtle", color: "primary", class: "ring-primary/25 bg-primary/10 text-primary" },
      { variant: "subtle", color: "secondary", class: "ring-secondary/25 bg-secondary/10 text-secondary" },
      { variant: "subtle", color: "success", class: "ring-success/25 bg-success/10 text-success" },
      { variant: "subtle", color: "warning", class: "ring-warning/25 bg-warning/10 text-warning" },
      { variant: "subtle", color: "error", class: "ring-destructive/25 bg-destructive/10 text-destructive" },
      { variant: "subtle", color: "info", class: "ring-info/25 bg-info/10 text-info" },
      { variant: "subtle", color: "neutral", class: "ring-neutral/25 bg-neutral/10 text-neutral" },
      // Ghost variants with colors
      { variant: "ghost", color: "primary", class: "text-primary" },
      { variant: "ghost", color: "secondary", class: "text-secondary" },
      { variant: "ghost", color: "success", class: "text-success" },
      { variant: "ghost", color: "warning", class: "text-warning" },
      { variant: "ghost", color: "error", class: "text-destructive" },
      { variant: "ghost", color: "info", class: "text-info" },
      { variant: "ghost", color: "neutral", class: "text-neutral" },
    ],
    defaultVariants: {
      variant: "default",
      color: "primary",
      size: "default",
    },
  },
)

export type BadgeVariants = VariantProps<typeof badgeVariants>
export type BadgeColor = SemanticColor
