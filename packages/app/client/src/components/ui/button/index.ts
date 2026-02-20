import type { SemanticColor } from "@wenyan/shared"
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Button } from "./Button.vue"

/**
 * Button component with variants matching Nuxt UI's UButton.
 *
 * HOVER STATE IMPLEMENTATION:
 * We use CSS Relative Color Syntax for hover states instead of opacity modifiers.
 * - Solid variants: Use dedicated -hover colors (e.g., bg-primary-hover)
 * - These are defined in style.css using: oklch(from <color> calc(l * 0.85) c h)
 * - This reduces lightness by 15% while preserving saturation and hue
 * - Result: Rich, vibrant hover states without desaturation
 * - Opacity modifiers (/75) would make colors transparent/washed out
 *
 * Browser Support: Chrome 119+, Safari 16.4+, Firefox 128+ (all 2023-2024)
 * This is an intentional requirement for modern color handling. No fallback provided.
 *
 * @variant solid - Filled background with inverted text (default)
 *   Use for: Primary actions, CTAs, main buttons
 *   Styling: Colored background, darkened on hover
 *   Example: Submit forms, Save changes, Create new items
 *
 * @variant outline - Ring border with transparent background
 *   Use for: Secondary actions, cancel buttons
 *   Styling: Inset ring at 50% opacity, 10% bg on hover
 *   Example: Cancel, Go back, View details
 *
 * @variant soft - Tinted background without border
 *   Use for: Tertiary actions, subtle CTAs
 *   Styling: 10% opacity background, 15% on hover
 *   Example: Filter buttons, tag selections, low-emphasis actions
 *
 * @variant subtle - Tinted background with ring border
 *   Use for: Alternative secondary actions
 *   Styling: 25% opacity ring-inset + 10% bg, 15% bg on hover
 *   Example: Alternative options, secondary selections
 *
 * @variant ghost - Transparent, shows background only on hover
 *   Use for: Navigation items, icon buttons, minimal emphasis
 *   Styling: Transparent, 10% opacity on hover
 *   Example: Menu items, toolbar buttons, table row actions
 *
 * @variant link - Text-only with no background
 *   Use for: Inline links, navigation within text
 *   Styling: Text color, 75% opacity on hover, underline
 *   Example: "Learn more", "View documentation", text links
 *
 * @sizes xs, sm, default, lg, xl - Progressive height scaling
 * @sizes icon, icon-sm, icon-lg - Square buttons for icons (w=h)
 *
 * Design notes:
 * - Solid variant uses inverted text with colored background
 * - Outline uses ring-inset at 50% opacity, not border
 * - Soft has 10% bg, subtle has 10% bg + 25% ring-inset
 * - Ghost only shows background on hover (10% opacity)
 * - Link reduces to 75% opacity on hover
 * - Focus states use 2px ring at full color opacity
 */
const buttonColorVariants: Record<SemanticColor, string> = {
  primary: "",
  secondary: "",
  success: "",
  warning: "",
  error: "",
  info: "",
  neutral: "",
}

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Nuxt UI variants (exact match)
        solid: "shadow-sm",
        outline: "ring-1 ring-inset bg-transparent focus-visible:ring-2",
        soft: "",
        subtle: "ring-1 ring-inset",
        ghost: "",
        link: "underline-offset-4 hover:underline p-0 h-auto shadow-none hover:opacity-75 active:opacity-75",
      },
      color: buttonColorVariants,
      size: {
        "xs": "h-7 px-2 text-xs rounded",
        "sm": "h-8 px-3 text-xs rounded-md",
        "default": "h-9 px-4 py-2 rounded-md",
        "lg": "h-10 px-6 text-base rounded-md",
        "xl": "h-12 px-8 text-lg rounded-lg",
        "icon": "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
        "icon-lg": "h-10 w-10 p-0",
      },
    },
    compoundVariants: [
      // Solid variants with colors (using relative color hover states)
      {
        variant: "solid",
        color: "primary",
        class: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover",
      },
      {
        variant: "solid",
        color: "secondary",
        class: "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-hover",
      },
      {
        variant: "solid",
        color: "success",
        class: "bg-success text-black hover:bg-success-hover active:bg-success-hover",
      },
      {
        variant: "solid",
        color: "warning",
        class: "bg-warning text-black hover:bg-warning-hover active:bg-warning-hover",
      },
      {
        variant: "solid",
        color: "error",
        class: "bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-hover",
      },
      {
        variant: "solid",
        color: "info",
        class: "bg-info text-info-foreground hover:bg-info-hover active:bg-info-hover",
      },
      {
        variant: "solid",
        color: "neutral",
        class: "bg-neutral text-white hover:bg-neutral-hover active:bg-neutral-hover",
      },
      // Outline variants with colors
      {
        variant: "outline",
        color: "primary",
        class: "ring-primary/50 text-primary hover:bg-primary/10 active:bg-primary/10 focus-visible:ring-primary",
      },
      {
        variant: "outline",
        color: "secondary",
        class: "ring-secondary/50 text-secondary hover:bg-secondary/10 active:bg-secondary/10 focus-visible:ring-secondary",
      },
      {
        variant: "outline",
        color: "success",
        class: "ring-selective-yellow-500/50 text-selective-yellow-700 hover:bg-selective-yellow-500/10 active:bg-selective-yellow-500/10 focus-visible:ring-selective-yellow-500",
      },
      {
        variant: "outline",
        color: "warning",
        class: "ring-sorbus-500/50 text-sorbus-700 hover:bg-sorbus-500/10 active:bg-sorbus-500/10 focus-visible:ring-sorbus-500",
      },
      {
        variant: "outline",
        color: "error",
        class: "ring-destructive/50 text-destructive hover:bg-destructive/10 active:bg-destructive/10 focus-visible:ring-destructive",
      },
      {
        variant: "outline",
        color: "info",
        class: "ring-info/50 text-info hover:bg-info/10 active:bg-info/10 focus-visible:ring-info",
      },
      {
        variant: "outline",
        color: "neutral",
        class: "ring-neutral/50 text-neutral hover:bg-neutral/10 active:bg-neutral/10 focus-visible:ring-neutral",
      },
      // Soft variants with colors
      {
        variant: "soft",
        color: "primary",
        class: "bg-primary/10 text-primary hover:bg-primary/15 active:bg-primary/15",
      },
      {
        variant: "soft",
        color: "secondary",
        class: "bg-secondary/10 text-secondary hover:bg-secondary/15 active:bg-secondary/15",
      },
      {
        variant: "soft",
        color: "success",
        class: "bg-selective-yellow-500/10 text-selective-yellow-700 hover:bg-selective-yellow-500/15 active:bg-selective-yellow-500/15",
      },
      {
        variant: "soft",
        color: "warning",
        class: "bg-sorbus-500/10 text-sorbus-700 hover:bg-sorbus-500/15 active:bg-sorbus-500/15",
      },
      {
        variant: "soft",
        color: "error",
        class: "bg-destructive/10 text-destructive hover:bg-destructive/15 active:bg-destructive/15",
      },
      {
        variant: "soft",
        color: "info",
        class: "bg-info/10 text-info hover:bg-info/15 active:bg-info/15",
      },
      {
        variant: "soft",
        color: "neutral",
        class: "bg-neutral/10 text-neutral hover:bg-neutral/15 active:bg-neutral/15",
      },
      // Subtle variants with colors
      {
        variant: "subtle",
        color: "primary",
        class: "ring-primary/25 bg-primary/10 text-primary hover:bg-primary/15 active:bg-primary/15",
      },
      {
        variant: "subtle",
        color: "secondary",
        class: "ring-secondary/25 bg-secondary/10 text-secondary hover:bg-secondary/15 active:bg-secondary/15",
      },
      {
        variant: "subtle",
        color: "success",
        class: "ring-selective-yellow-500/25 bg-selective-yellow-500/10 text-selective-yellow-700 hover:bg-selective-yellow-500/15 active:bg-selective-yellow-500/15",
      },
      {
        variant: "subtle",
        color: "warning",
        class: "ring-sorbus-500/25 bg-sorbus-500/10 text-sorbus-700 hover:bg-sorbus-500/15 active:bg-sorbus-500/15",
      },
      {
        variant: "subtle",
        color: "error",
        class: "ring-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15 active:bg-destructive/15",
      },
      {
        variant: "subtle",
        color: "info",
        class: "ring-info/25 bg-info/10 text-info hover:bg-info/15 active:bg-info/15",
      },
      {
        variant: "subtle",
        color: "neutral",
        class: "ring-neutral/25 bg-neutral/10 text-neutral hover:bg-neutral/15 active:bg-neutral/15",
      },
      // Ghost variants with colors
      {
        variant: "ghost",
        color: "primary",
        class: "text-primary hover:bg-primary/10 active:bg-primary/10",
      },
      {
        variant: "ghost",
        color: "secondary",
        class: "text-secondary hover:bg-secondary/10 active:bg-secondary/10",
      },
      {
        variant: "ghost",
        color: "success",
        class: "text-selective-yellow-700 hover:bg-selective-yellow-500/10 active:bg-selective-yellow-500/10",
      },
      {
        variant: "ghost",
        color: "warning",
        class: "text-sorbus-700 hover:bg-sorbus-500/10 active:bg-sorbus-500/10",
      },
      {
        variant: "ghost",
        color: "error",
        class: "text-destructive hover:bg-destructive/10 active:bg-destructive/10",
      },
      {
        variant: "ghost",
        color: "info",
        class: "text-info hover:bg-info/10 active:bg-info/10",
      },
      {
        variant: "ghost",
        color: "neutral",
        class: "text-neutral hover:bg-neutral/10 active:bg-neutral/10",
      },
      // Link variants with colors
      {
        variant: "link",
        color: "primary",
        class: "text-primary",
      },
      {
        variant: "link",
        color: "secondary",
        class: "text-secondary",
      },
      {
        variant: "link",
        color: "success",
        class: "text-selective-yellow-700",
      },
      {
        variant: "link",
        color: "warning",
        class: "text-sorbus-700",
      },
      {
        variant: "link",
        color: "error",
        class: "text-destructive",
      },
      {
        variant: "link",
        color: "info",
        class: "text-info",
      },
      {
        variant: "link",
        color: "neutral",
        class: "text-neutral",
      },
    ],
    defaultVariants: {
      variant: "solid",
      color: "primary",
      size: "default",
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
export type ButtonColor = SemanticColor
