import { z } from "zod"

// Role schema
export const roleSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(50),
  description: z.string().max(256).optional().nullable(),
})

export type Role = z.infer<typeof roleSchema>

// Controlled Action code enum
export const controlledActionCodeEnum = z.enum([
  "manage_system_settings",
  "configure_app",
  "manage_dashboard",
  "manage_access_control",
  "view_debug_output",
  "use_core_functionality",
  "view_studio_view",
  "view_budget_views",
  "view_smart_scheduling_hub",
])

export type ControlledActionCode = z.infer<typeof controlledActionCodeEnum>

// Controlled Action schema
export const controlledActionSchema = z.object({
  id: z.number().int(),
  code: z.union([controlledActionCodeEnum, z.string()]),
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional().nullable(),
})

export type ControlledAction = z.infer<typeof controlledActionSchema>

// Role- Controlled Action relationship
export const roleRelControlledActionSchema = z.object({
  id: z.number().int(),
  roleId: z.number().int(),
  controlledActionId: z.number().int(),
})

export type RoleRelControlledAction = z.infer<
  typeof roleRelControlledActionSchema
>

// External User ID - Role relationship
export const externalUserIdRelRoleSchema = z.object({
  id: z.number().int(),
  externalUserId: z.string().email().min(1).max(128),
  roleId: z.number().int(),
})

export type ExternalUserIdRelRole = z.infer<typeof externalUserIdRelRoleSchema>

// Protected system role IDs that cannot be modified
export const PROTECTED_ROLE_IDS = [1, 2, 3] as const

export function isProtectedRole(roleId: number): boolean {
  return PROTECTED_ROLE_IDS.includes(roleId as (typeof PROTECTED_ROLE_IDS)[number])
}
