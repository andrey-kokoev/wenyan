export function simulateAttack(attempts: number): { quarantinedAt: number; acceptedBeforeQuarantine: number } {
  const quarantinedAt = Math.min(3, attempts)
  return { quarantinedAt, acceptedBeforeQuarantine: quarantinedAt }
}
