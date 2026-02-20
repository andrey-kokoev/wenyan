export interface SealThresholdPolicy {
  minImperialSignaturesByGenre: Record<string, number>
}

export const DEFAULT_THRESHOLD_POLICY: SealThresholdPolicy = {
  minImperialSignaturesByGenre: {
    ti_definition: 3,
    edict: 1,
  },
}

export function resolveRequiredImperialSignatures(
  genre: string,
  overrides?: Partial<SealThresholdPolicy>,
): number {
  const merged = {
    ...DEFAULT_THRESHOLD_POLICY.minImperialSignaturesByGenre,
    ...(overrides?.minImperialSignaturesByGenre ?? {}),
  }
  return merged[genre] ?? 1
}
