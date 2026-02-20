import type { ArchiveRepository } from '@wenyan/archive'

export type ImperialRole =
  | 'emperor'
  | 'minister_works'
  | 'minister_finance'
  | 'censor_chief'
  | 'foreman_electrical'
  | 'foreman_structural'
  | 'foreman_hydraulic'
  | `worker_${string}`

export interface ImperialWorksPolicy {
  constitutionalThreshold: number
  emergencyAudience: string[]
  quarantineHours: number
}

export const IMPERIAL_WORKS_GENRES = [
  'blueprint_change',
  'work_order',
  'safety_incident',
  'completion_report',
  'material_request',
] as const

export function isImperialWorksGenre(genre: string): boolean {
  return IMPERIAL_WORKS_GENRES.includes(genre as (typeof IMPERIAL_WORKS_GENRES)[number])
}

export function isImperialWorksRole(role: string): boolean {
  return (
    workerRole(role) ||
    role.startsWith('foreman_') ||
    role === 'emperor' ||
    role === 'minister_works' ||
    role === 'minister_finance' ||
    role === 'censor_chief'
  )
}

export const DEFAULT_IMPERIAL_WORKS_POLICY: ImperialWorksPolicy = {
  constitutionalThreshold: 2,
  emergencyAudience: ['emperor', 'minister_works', 'minister_finance', 'censor_chief'],
  quarantineHours: 1,
}

const DRAFT_RULES: Record<string, string[]> = {
  genesis_admin: ['*'],
  emperor: ['*'],
  minister_works: ['work_order', 'material_request', 'edict', 'safety_incident', 'completion_report'],
  minister_finance: ['work_order', 'material_request', 'edict'],
  censor_chief: ['safety_incident', 'completion_report', 'edict'],
  foreman_electrical: ['safety_incident', 'completion_report'],
  foreman_structural: ['safety_incident', 'completion_report'],
  foreman_hydraulic: ['safety_incident', 'completion_report'],
}

const REVIEW_RULES: Record<string, string[]> = {
  genesis_admin: ['*'],
  emperor: ['*'],
  minister_works: ['*'],
  minister_finance: ['work_order', 'material_request', 'completion_report'],
  censor_chief: ['*'],
  foreman_electrical: ['work_order', 'completion_report', 'safety_incident'],
  foreman_structural: ['work_order', 'completion_report', 'safety_incident'],
  foreman_hydraulic: ['work_order', 'completion_report', 'safety_incident'],
}

const AUTHORIZE_RULES: Record<string, string[]> = {
  genesis_admin: ['*'],
  emperor: ['*'],
  minister_works: ['work_order', 'material_request', 'completion_report', 'safety_incident'],
  minister_finance: ['material_request', 'completion_report'],
}

function workerRole(role: string): boolean {
  return role.startsWith('worker_')
}

export const RoleHierarchy = {
  canDraftGenre(role: string, genre: string): boolean {
    if (workerRole(role)) return ['completion_report', 'safety_incident'].includes(genre)
    const allowed = DRAFT_RULES[role] ?? []
    return allowed.includes('*') || allowed.includes(genre)
  },
  canReviewGenre(role: string, genre: string): boolean {
    if (workerRole(role)) return false
    const allowed = REVIEW_RULES[role] ?? []
    return allowed.includes('*') || allowed.includes(genre)
  },
  canAuthorizeGenre(role: string, genre: string): boolean {
    if (workerRole(role)) return false
    const allowed = AUTHORIZE_RULES[role] ?? []
    return allowed.includes('*') || allowed.includes(genre)
  },
  canAmendConstitution(role: string): boolean {
    return role === 'emperor' || role === 'minister_works' || role === 'censor_chief'
  },
}

export function canDraftGenre(role: string, genre: string): boolean {
  return RoleHierarchy.canDraftGenre(role, genre)
}

export function canReviewGenre(role: string, genre: string): boolean {
  return RoleHierarchy.canReviewGenre(role, genre)
}

export function canAuthorizeGenre(role: string, genre: string): boolean {
  return RoleHierarchy.canAuthorizeGenre(role, genre)
}

export function canAmendConstitution(role: string): boolean {
  return RoleHierarchy.canAmendConstitution(role)
}

export class EmergencyRouter {
  constructor(private readonly repo: Pick<ArchiveRepository, 'setSiteStatus' | 'appendCensorateAlert'>) {}

  async routeSafetyIncident(input: {
    messageId: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    location: string
    actorId: string
  }): Promise<{ routedTo: string[]; quarantined: boolean }> {
    await this.setSiteQuarantined(`safety:${input.messageId}:${input.location}`)
    await this.repo.appendCensorateAlert({
      alertType: 'safety_incident',
      severity: input.severity === 'critical' ? 'critical' : 'warning',
      actorId: input.actorId,
      evidence: { location: input.location, messageId: input.messageId },
      createdAt: new Date().toISOString(),
      actionTaken: 'quarantine',
    })
    return { routedTo: [...DEFAULT_IMPERIAL_WORKS_POLICY.emergencyAudience], quarantined: true }
  }

  async setSiteQuarantined(reason = 'manual'): Promise<void> {
    await this.repo.setSiteStatus('QUARANTINED', reason)
  }

  async resumeSite(reason = 'manual'): Promise<void> {
    await this.repo.setSiteStatus('RESUMED', reason)
  }
}

export class ConstructionCorruptionDetector {
  detectGhostWorker(input: { distanceKm: number; deltaSeconds: number }): boolean {
    const speedKmh = input.deltaSeconds <= 0 ? Number.POSITIVE_INFINITY : (input.distanceKm / input.deltaSeconds) * 3600
    return speedKmh > 1000
  }

  detectMaterialDiversion(input: { projectClass: string; materialTier: string; priorLuxuryApprovals: number }): boolean {
    return input.projectClass === 'frugal' && input.materialTier === 'luxury' && input.priorLuxuryApprovals >= 3
  }

  detectScheduleImpossible(input: { approvedHours: number; windowHours: number }): boolean {
    return input.approvedHours > input.windowHours
  }

  detectStructuralCabal(input: { mutualApprovals: number; baselinePerHour: number; windowHours: number }): boolean {
    const rate = input.mutualApprovals / Math.max(input.windowHours, 1)
    return rate > input.baselinePerHour * 10
  }
}
