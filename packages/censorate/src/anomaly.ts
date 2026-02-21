import type { AnomalyAlert } from '@andrey-kokoev/wenyan-core'
type AnomalySeverity = 'info' | 'warning' | 'critical'

export interface VelocitySample {
  actorId: string
  timestampIso: string
}

export interface TemporalSample {
  nodeId: string
  claimedTimestampIso: string
  observedTimestampIso: string
}

export interface GeographicSample {
  actorId: string
  from: string
  to: string
  distanceKm: number
  deltaSeconds: number
}

export interface CoalitionSample {
  genre: string
  offices: string[]
  observedProbability: number
  baselineProbability: number
}

export interface AlertRepository {
  appendCensorateAlert(alert: {
    alertType: string
    severity: AnomalySeverity
    actorId?: string
    nodeId?: string
    evidence: Record<string, unknown>
    createdAt: string
    actionTaken?: string
  }): void | Promise<void>
}

export class AnomalyDetector {
  constructor(private readonly repository: AlertRepository) {}

  async detectVelocity(samples: VelocitySample[], thresholdPerMinute: number): Promise<AnomalyAlert | undefined> {
    if (samples.length === 0) return undefined

    const byActor = new Map<string, number[]>()
    for (const sample of samples) {
      const ts = new Date(sample.timestampIso).getTime()
      if (!Number.isFinite(ts)) continue
      const arr = byActor.get(sample.actorId) ?? []
      arr.push(ts)
      byActor.set(sample.actorId, arr)
    }

    for (const [actorId, timestamps] of byActor) {
      if (timestamps.length === 0) continue
      timestamps.sort((a, b) => a - b)
      const spanMs = Math.max(timestamps[timestamps.length - 1] - timestamps[0], 1000)
      const ratePerMinute = (timestamps.length * 60_000) / spanMs
      if (ratePerMinute > thresholdPerMinute) {
        return this.emit('velocity', 'critical', {
          actorId,
          evidence: {
            count: timestamps.length,
            threshold_per_minute: thresholdPerMinute,
            rate_per_minute: Number(ratePerMinute.toFixed(2)),
            span_ms: spanMs,
          },
          actionTaken: 'quarantine',
        })
      }
    }

    return undefined
  }

  async detectTemporal(sample: TemporalSample, driftMsThreshold: number): Promise<AnomalyAlert | undefined> {
    const drift = Math.abs(new Date(sample.claimedTimestampIso).getTime() - new Date(sample.observedTimestampIso).getTime())
    if (drift <= driftMsThreshold) return undefined
    return this.emit('temporal_anomaly', 'critical', {
      nodeId: sample.nodeId,
      evidence: { drift_ms: drift, threshold_ms: driftMsThreshold },
      actionTaken: 'log',
    })
  }

  async detectGeographic(sample: GeographicSample, maxKmh = 1000): Promise<AnomalyAlert | undefined> {
    const speedKmh = sample.deltaSeconds <= 0 ? Number.POSITIVE_INFINITY : (sample.distanceKm / sample.deltaSeconds) * 3600
    if (speedKmh <= maxKmh) return undefined
    return this.emit('geographic_impossibility', 'critical', {
      actorId: sample.actorId,
      evidence: { from: sample.from, to: sample.to, speed_kmh: speedKmh, max_kmh: maxKmh },
      actionTaken: 'quarantine',
    })
  }

  async detectCoalition(sample: CoalitionSample, zThreshold = 3): Promise<AnomalyAlert | undefined> {
    const variance = Math.max(sample.baselineProbability * (1 - sample.baselineProbability), 0.0001)
    const z = (sample.observedProbability - sample.baselineProbability) / Math.sqrt(variance)
    if (z <= zThreshold) return undefined
    return this.emit('coalition', 'warning', {
      evidence: {
        genre: sample.genre,
        offices: sample.offices,
        observed_probability: sample.observedProbability,
        baseline_probability: sample.baselineProbability,
        z_score: z,
      },
      actionTaken: 'log',
    })
  }

  private async emit(
    alertType: string,
    severity: AnomalySeverity,
    input: { actorId?: string; nodeId?: string; evidence: Record<string, unknown>; actionTaken?: string },
  ): Promise<AnomalyAlert> {
    const createdAt = new Date().toISOString()
    const alert: AnomalyAlert = {
      id: `${alertType}:${Date.now()}`,
      alert_type: alertType,
      severity,
      actor_id: input.actorId,
      node_id: input.nodeId,
      evidence: input.evidence,
      created_at: createdAt,
      action_taken: input.actionTaken,
    }
    await this.repository.appendCensorateAlert({
      alertType,
      severity,
      actorId: input.actorId,
      nodeId: input.nodeId,
      evidence: input.evidence,
      createdAt,
      actionTaken: input.actionTaken,
    })
    return alert
  }
}
