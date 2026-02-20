export interface BenchmarkResult {
  profile: 'toy' | 'stress'
  metric: string
  value: number
  unit: string
}

export function parseProfile(argv: string[]): 'toy' | 'stress' {
  const idx = argv.indexOf('--profile')
  const value = idx >= 0 ? argv[idx + 1] : 'toy'
  return value === 'stress' ? 'stress' : 'toy'
}
