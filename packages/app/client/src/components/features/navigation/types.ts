// Basic types for navigation menu items
export interface NavigationMenuItem {
  label: string
  icon?: string
  to?: string
  description?: string
  children?: NavigationMenuItem[]
  disabled?: boolean
}

export interface AppMenuItem extends NavigationMenuItem {
  requiredAbility?: string
  isHidden?: boolean
  badge?:
    | string
    | number
    | {
        label: string
        color?: import("@wenyan/shared").SemanticColor
      }
  children?: Omit<AppMenuItem, "children">[]
}

export type ControlledActionCode = string

export interface NavigationMenu {
  name: string
  description?: string
  requiredAbility?: string
  menuItems: AppMenuItem[]
}
