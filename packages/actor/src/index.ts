import type { AppointmentLawContent } from '@andrey-kokoev/wenyan-core'

export type ActorRole = string

export type HumanActor = {
  kind: 'human'
  yubikey_attestation: string
}

export type AgentActor = {
  kind: 'agent'
  service_account: string
  mtls_fingerprint: string
}

export type Provenance = HumanActor | AgentActor

export interface RolePermissions {
  draft: boolean
  review: boolean
  authorize: boolean
}

function permissionsFromLaw(role: string, appointmentLaw?: AppointmentLawContent): string[] | undefined {
  return appointmentLaw?.roles?.[role]?.permissions
}

export function canDraft(role: string, appointmentLaw?: AppointmentLawContent): boolean {
  const perms = permissionsFromLaw(role, appointmentLaw)
  if (!perms) return false
  return perms.includes('draft')
}

export function canReview(role: string, appointmentLaw?: AppointmentLawContent): boolean {
  const perms = permissionsFromLaw(role, appointmentLaw)
  if (!perms) return false
  return perms.includes('review')
}

export function canAuthorize(role: string, appointmentLaw?: AppointmentLawContent): boolean {
  const perms = permissionsFromLaw(role, appointmentLaw)
  if (!perms) return false
  return perms.includes('authorize')
}

export function allowedGenresForRole(role: string, appointmentLaw?: AppointmentLawContent): string[] {
  return appointmentLaw?.roles?.[role]?.allowed_genres ?? []
}

export function rolePermissions(role: string, appointmentLaw?: AppointmentLawContent): RolePermissions {
  return {
    draft: canDraft(role, appointmentLaw),
    review: canReview(role, appointmentLaw),
    authorize: canAuthorize(role, appointmentLaw),
  }
}

export function isHumanActor(p: Provenance): p is HumanActor {
  return p.kind === 'human'
}

export function isAgentActor(p: Provenance): p is AgentActor {
  return p.kind === 'agent'
}
