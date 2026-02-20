import type { ThemeColors, Theme } from "@wenyan/shared"

const STYLE_ID = "theme-registry-overrides"

function cssVars(colors: ThemeColors): string {
  const entries: Array<[string, string]> = [
    ["--ui-bg", colors.canvas],
    ["--ui-bg-elevated", colors.elevated],
    ["--ui-bg-muted", colors.inset],
    ["--ui-bg-accented", colors.overlay],
    ["--ui-text", colors.text],
    ["--ui-border", colors.border],
    ["--ui-primary", colors.primary],
    ["--ui-secondary", colors.secondary],
    ["--ui-success", colors.success],
    ["--ui-warning", colors.warning],
    ["--ui-error", colors.error],
    ["--ui-info", colors.info],
    ["--ui-neutral", colors.neutral],

    ["--background", colors.canvas],
    ["--foreground", colors.text],
    ["--card", colors.surface],
    ["--card-foreground", colors.text],
    ["--popover", colors.surface],
    ["--popover-foreground", colors.text],
    ["--muted", colors.inset],
    ["--muted-foreground", colors.mutedText],
    ["--accent", colors.accent],
    ["--accent-foreground", colors.accentForeground],
    ["--border", colors.border],
    ["--input", colors.border],
    ["--ring", colors.primary],

    ["--primary", colors.primary],
    ["--primary-foreground", colors.primaryForeground],
    ["--secondary", colors.secondary],
    ["--secondary-foreground", colors.secondaryForeground],
    ["--destructive", colors.error],
    ["--destructive-foreground", colors.errorForeground],

    ["--sidebar", colors.elevated],
    ["--sidebar-foreground", colors.text],
    ["--sidebar-primary", colors.primary],
    ["--sidebar-primary-foreground", colors.primaryForeground],
    ["--sidebar-accent", colors.accent],
    ["--sidebar-accent-foreground", colors.accentForeground],
    ["--sidebar-border", colors.border],
    ["--sidebar-ring", colors.primary],
  ]

  return entries.map(([key, value]) => `${key}: ${value};`).join("")
}

export function applyTheme(theme: Theme) {
  const lightVars = cssVars(theme.modes.light)
  const darkVars = cssVars(theme.modes.dark)
  const css = `:root{${lightVars}}.dark{${darkVars}}`

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement("style")
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = css
}

export function clearThemeOverrides() {
  const style = document.getElementById(STYLE_ID)
  if (style) {
    style.remove()
  }
}
