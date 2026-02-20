import { describe, expect, it } from 'vitest'
import { ConstructionCorruptionDetector, EmergencyRouter, RoleHierarchy } from './index'

describe('imperial works role hierarchy', () => {
  it('enforces worker drafting boundaries', () => {
    expect(RoleHierarchy.canDraftGenre('worker_001', 'completion_report')).toBe(true)
    expect(RoleHierarchy.canDraftGenre('worker_001', 'work_order')).toBe(false)
  })

  it('limits constitutional amendment to imperial authorities', () => {
    expect(RoleHierarchy.canAmendConstitution('emperor')).toBe(true)
    expect(RoleHierarchy.canAmendConstitution('worker_010')).toBe(false)
  })
})

describe('emergency router and corruption detector', () => {
  it('quarantines site on safety incident route', async () => {
    const calls: string[] = []
    const router = new EmergencyRouter({
      setSiteStatus: async (status) => {
        calls.push(status)
      },
      appendCensorateAlert: async () => undefined,
    })
    const out = await router.routeSafetyIncident({ messageId: 'm1', severity: 'critical', location: 'north-wing', actorId: 'worker_1' })
    expect(out.quarantined).toBe(true)
    expect(calls).toContain('QUARANTINED')
  })

  it('detects ghost worker and structural cabal', () => {
    const d = new ConstructionCorruptionDetector()
    expect(d.detectGhostWorker({ distanceKm: 1000, deltaSeconds: 60 })).toBe(true)
    expect(d.detectStructuralCabal({ mutualApprovals: 10, baselinePerHour: 0.1, windowHours: 1 })).toBe(true)
  })
})
