import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface ExampleConfig {
  nodes: string[]
  tiers: number
  thresholds: {
    pbft: number
    anomaly: number
    auditSample: number
  }
  load: {
    workers: number
    sensors: number
    durationSeconds: number
    seedTasks: number
    attackAttempts: number
  }
  timing: {
    routingLatencyMs: number
    syncSeconds: number
    convergenceMs: number
  }
  storage: {
    hotDbTargetGb: number
    coldPrefix: string
  }
}

function parseNumber(name: string, value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    throw new Error(`invalid numeric value for ${name}`)
  }
  return n
}

function parseStringArray(name: string, value: unknown): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`invalid string array for ${name}`)
  }
  return value as string[]
}

export function loadExampleConfig(configPath: string): ExampleConfig {
  const fullPath = resolve(configPath)
  const raw = JSON.parse(readFileSync(fullPath, 'utf8')) as Record<string, unknown>
  const thresholds = raw.thresholds as Record<string, unknown>
  const load = raw.load as Record<string, unknown>
  const timing = raw.timing as Record<string, unknown>
  const storage = raw.storage as Record<string, unknown>
  if (!thresholds || !load || !timing || !storage) {
    throw new Error('invalid config: missing thresholds/load/timing/storage')
  }

  return {
    nodes: parseStringArray('nodes', raw.nodes),
    tiers: parseNumber('tiers', raw.tiers),
    thresholds: {
      pbft: parseNumber('thresholds.pbft', thresholds.pbft),
      anomaly: parseNumber('thresholds.anomaly', thresholds.anomaly),
      auditSample: parseNumber('thresholds.auditSample', thresholds.auditSample),
    },
    load: {
      workers: parseNumber('load.workers', load.workers),
      sensors: parseNumber('load.sensors', load.sensors),
      durationSeconds: parseNumber('load.durationSeconds', load.durationSeconds),
      seedTasks: parseNumber('load.seedTasks', load.seedTasks),
      attackAttempts: parseNumber('load.attackAttempts', load.attackAttempts),
    },
    timing: {
      routingLatencyMs: parseNumber('timing.routingLatencyMs', timing.routingLatencyMs),
      syncSeconds: parseNumber('timing.syncSeconds', timing.syncSeconds),
      convergenceMs: parseNumber('timing.convergenceMs', timing.convergenceMs),
    },
    storage: {
      hotDbTargetGb: parseNumber('storage.hotDbTargetGb', storage.hotDbTargetGb),
      coldPrefix: String(storage.coldPrefix ?? ''),
    },
  }
}

export function requiredArg(flag: string): string {
  const found = process.argv.find((x) => x.startsWith(`${flag}=`))
  if (!found) {
    throw new Error(`missing required argument ${flag}=...`)
  }
  return found.slice(flag.length + 1)
}
