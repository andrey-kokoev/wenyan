import type { AppMenuItem, NavigationMenu } from "./types"

const baseMenuItems: AppMenuItem[] = [
  {
    label: "Workspaces",
    icon: "heroicons:list-bullet",
    to: "/workspaces",
    description: "Manage workspaces and access.",
  },
  {
    label: "Rules",
    icon: "heroicons:clipboard-document-check",
    to: "/rules",
    description: "Manage business rules and constraints.",
  },
]

export const baseMenu: NavigationMenu = {
  name: "Main",
  description: "Core navigation",
  menuItems: baseMenuItems,
}

export const devMenu: NavigationMenu = {
  name: "Dev",
  description: "Developer utilities",
  requiredAbility: "view_debug_output",
  menuItems: [
    {
      label: "UI Examples",
      icon: "heroicons:swatch",
      requiredAbility: "view_debug_output",
      description: "Interactive examples of UI components.",
      children: [
        {
          label: "Overview",
          icon: "heroicons:squares-2x2",
          to: "/ui-examples",
          description: "All UI components overview.",
        },
        {
          label: "Buttons",
          icon: "heroicons:cursor-arrow-ripple",
          to: "/ui-examples/buttons",
          description: "Button variants and examples.",
        },
        {
          label: "Cards",
          icon: "heroicons:rectangle-stack",
          to: "/ui-examples/cards",
          description: "Card component examples.",
        },
        {
          label: "Inputs",
          icon: "heroicons:pencil-square",
          to: "/ui-examples/inputs",
          description: "Form input examples.",
        },
        {
          label: "Dialogs",
          icon: "heroicons:window",
          to: "/ui-examples/dialogs",
          description: "Dialog and modal examples.",
        },
        {
          label: "Badges",
          icon: "heroicons:tag",
          to: "/ui-examples/badges",
          description: "Badge component examples.",
        },
        {
          label: "Tooltips",
          icon: "heroicons:chat-bubble-bottom-center-text",
          to: "/ui-examples/tooltips",
          description: "Tooltip component examples.",
        },
      ],
    },
    {
      label: "Color Theme",
      icon: "heroicons:paint-brush",
      requiredAbility: "view_debug_output",
      to: "/color-theme",
      description: "Color palette and theme visualization.",
    },
  ],
}

export const appAdminMenu: NavigationMenu = {
  name: "App admin",
  description: "Application administration",
  menuItems: [
    {
      label: "Access Control",
      icon: "heroicons:lock-closed",
      requiredAbility: "manage_access_control",
      description: "Manage users, roles, and permissions.",
      children: [
        {
          label: "Overview",
          icon: "heroicons:squares-2x2",
          to: "/access-control",
          description: "Access control dashboard.",
        },
        {
          label: "Roles",
          icon: "heroicons:identification",
          to: "/access-control/roles",
          description: "Manage user roles.",
        },
        {
          label: "Controlled Actions",
          icon: "heroicons:shield-check",
          to: "/access-control/controlled-actions",
          description: "Manage permission actions.",
        },
        {
          label: "External Users",
          icon: "heroicons:users",
          to: "/access-control/external-users",
          description: "Manage external user access.",
        },
      ],
    },
    {
      label: "AI Responders",
      icon: "heroicons:adjustments-horizontal",
      requiredAbility: "configure_application",
      to: "/admin/responders",
      description: "Manage responder mappings and model assignments.",
    },
  ],
}

export const tenantAdminMenu: NavigationMenu = {
  name: "Tenant admin",
  description: "Tenant-level administration",
  requiredAbility: "configure_application",
  menuItems: [
    {
      label: "AI Providers",
      icon: "heroicons:cpu-chip",
      requiredAbility: "configure_application",
      to: "/admin/providers",
      description: "Manage AI provider credentials and coverage.",
    },
    {
      label: "Utility Services",
      icon: "heroicons:wrench-screwdriver",
      requiredAbility: "configure_application",
      to: "/utility-services",
      description: "Manage shared utility service integrations.",
    },
  ],
}

export const appearanceMenu: NavigationMenu = {
  name: "Appearance",
  description: "Theme and visual settings",
  menuItems: [
    {
      label: "Theme Editor",
      icon: "heroicons:paint-brush",
      to: "/themes/edit",
      description: "Edit and clone color themes.",
    },
    {
      label: "Color Theme",
      icon: "heroicons:paint-brush",
      requiredAbility: "view_debug_output",
      to: "/color-theme",
      description: "Color palette and theme visualization.",
    },
  ],
}
