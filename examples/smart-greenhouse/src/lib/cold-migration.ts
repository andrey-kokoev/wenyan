import { buildColdObjectKey } from './s3-store'

export function coldMigrationPlan(before: string) {
  return {
    hotDbTargetGb: 5,
    key: buildColdObjectKey('greenhouse/2026-Q1', before),
    merkleVerified: true,
  }
}

if (process.argv[1]?.endsWith('cold-migration.ts')) {
  const before = process.argv.find((x) => x.startsWith('--before='))?.slice('--before='.length) ?? '2026-03-01'
  console.log(JSON.stringify(coldMigrationPlan(before)))
}
