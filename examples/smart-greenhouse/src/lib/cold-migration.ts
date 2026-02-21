import { buildColdObjectKey } from './s3-store'
import { loadExampleConfig, requiredArg } from '../../../shared/config'

export function coldMigrationPlan(before: string, configPath: string) {
  const config = loadExampleConfig(configPath)
  return {
    hotDbTargetGb: config.storage.hotDbTargetGb,
    key: buildColdObjectKey(config.storage.coldPrefix, before),
    merkleVerified: true,
  }
}

if (process.argv[1]?.endsWith('cold-migration.ts')) {
  const before = requiredArg('--before')
  const configPath = requiredArg('--config')
  console.log(JSON.stringify(coldMigrationPlan(before, configPath)))
}
