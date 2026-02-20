import type { AppointmentLawContent } from '@wenyan/core'

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

const legacyMatrix: Record<'scribe' | 'reviewer' | 'approver' | 'archivist' | 'admin', RolePermissions> = {
  scribe: { draft: true, review: false, authorize: false },
  reviewer: { draft: false, review: true, authorize: false },
  approver: { draft: false, review: true, authorize: true },
  archivist: { draft: false, review: false, authorize: false },
  admin: { draft: true, review: true, authorize: true },
}

function permissionsFromLaw(role: string, appointmentLaw?: AppointmentLawContent): string[] | undefined {
  return appointmentLaw?.roles?.[role]?.permissions
}

function legacyPermissions(role: string): RolePermissions {
  const m = legacyMatrix[role as keyof typeof legacyMatrix]
  if (m) return m
  return { draft: false, review: false, authorize: false }
}

export function canDraft(role: string, appointmentLaw?: AppointmentLawContent): boolean {
  const perms = permissionsFromLaw(role, appointmentLaw)
  if (perms) return perms.includes('draft')
  return legacyPermissions(role).draft
}

export function canReview(role: string, appointmentLaw?: AppointmentLawContent): boolean {
  const perms = permissionsFromLaw(role, appointmentLaw)
  if (perms) return perms.includes('review')
  return legacyPermissions(role).review
}

export function canAuthorize(role: string, appointmentLaw?: AppointmentLawContent): boolean {
  const perms = permissionsFromLaw(role, appointmentLaw)
  if (perms) return perms.includes('authorize')
  return legacyPermissions(role).authorize
}

export function allowedGenresForRole(role: string, appointmentLaw?: AppointmentLawContent): string[] {
  return appointmentLaw?.roles?.[role]?.allowed_genres ?? ['*']
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
