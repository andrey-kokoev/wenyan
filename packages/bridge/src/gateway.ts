import type { ArchiveRepository } from '@andrey-kokoev/wenyan-archive'
import { SqliteArchiveRepository } from '@andrey-kokoev/wenyan-archive/sqlite'
import type { BootstrapConfig, BridgeAdapterConfig, BridgeProtocol, MessageEnvelope } from '@andrey-kokoev/wenyan-core'
import { createHmac } from 'node:crypto'
import { KafkaBridgeAdapter } from './adapters/kafka'
import { MqttBridgeAdapter } from './adapters/mqtt'
import { NatsBridgeAdapter } from './adapters/nats'
import { ErpBridgeAdapter } from './adapters/erp-http'
import { PayrollBridgeAdapter } from './adapters/payroll-http'
import { RegulatoryBridgeAdapter } from './adapters/regulatory-mqtt'
import type { AdapterContext, BridgeAdapter, BridgeMetrics, ForeignMetadata } from './types'

interface BreakerState {
  outcomes: boolean[]
  pausedUntil: number
}

const MAX_FOREIGN_TOPIC_LENGTH = 256
const MAX_FOREIGN_HEADER_VALUE = 2048
const SAFE_TOPIC = /^[a-zA-Z0-9._:/-]+$/

type BridgeBootstrapConfig = {
  archive: BootstrapConfig['archive']
  genesis: BootstrapConfig['genesis']
  gateway: {
    listen: {
      host: string
      port: number
    }
    upstream?: string
    stream_mode?: 'sse'
  }
  auth: BootstrapConfig['auth']
  bridge: BootstrapConfig['bridge']
}

export interface BridgeGatewayOptions {
  archive?: ArchiveRepository
  bootstrap: BridgeBootstrapConfig
  apiBaseUrl?: string
  adapters?: BridgeAdapter[]
}

function nowIso (): string {
  return new Date().toISOString()
}

function encodeBase64Url (value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function defaultApiBaseUrl (config: BridgeBootstrapConfig): string {
  return `http://${config.gateway.listen.host}:${config.gateway.listen.port}/api/wenyan`
}

function asStringArray (input: unknown): string[] {
  if (typeof input === 'string' && input) return [input]
  if (!Array.isArray(input)) return []
  return input.filter((v): v is string => typeof v === 'string' && v.length > 0)
}

function matchesRoutingTarget (document: MessageEnvelope, adapter: BridgeAdapter): boolean {
  const routing = (document.metadata?.routing as Record<string, unknown> | undefined) ?? {}
  const foreignTargets = asStringArray(routing.foreign_system)
  const adapterTargets = asStringArray(routing.bridge_adapter)
  const protocolTargets = asStringArray(routing.protocol)
  const targets = [...foreignTargets, ...protocolTargets]
  if (adapterTargets.length === 0 && targets.length === 0) return true
  if (adapterTargets.includes(adapter.id)) return true
  return targets.includes(adapter.protocol)
}

function sanitizedEnvelope (document: MessageEnvelope, idempotencyKey: string): MessageEnvelope {
  return {
    id: document.id,
    genre: document.genre,
    payload: document.payload,
    actor: document.actor,
    submittedAt: document.submittedAt,
    metadata: {
      idempotency_key: idempotencyKey,
      routing: (document.metadata?.routing as Record<string, unknown> | undefined) ?? {},
      provenance: (document.metadata?.provenance as Record<string, unknown> | undefined) ?? {},
    },
  }
}

function sanitizeForeignMetadata (metadata: ForeignMetadata): ForeignMetadata {
  const subject = String(metadata.subjectOrTopic ?? '')
  if (subject.length === 0 || subject.length > MAX_FOREIGN_TOPIC_LENGTH || !SAFE_TOPIC.test(subject)) {
    throw new Error('foreign-metadata-invalid-topic')
  }
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(metadata.headers ?? {})) {
    const key = String(k).trim()
    const normalized = key.toLowerCase()
    if (!key || normalized === '__proto__' || normalized === 'constructor' || normalized === 'prototype') continue
    const value = String(v)
    if (value.length > MAX_FOREIGN_HEADER_VALUE) continue
    headers[key] = value
  }
  return {
    ...metadata,
    subjectOrTopic: subject,
    headers,
  }
}

export class BridgeGateway {
  private readonly archive: ArchiveRepository
  private readonly config: BridgeBootstrapConfig
  private readonly apiBaseUrl: string
  private readonly adapters: BridgeAdapter[]
  private readonly authHeader: string
  private pollTimer: NodeJS.Timeout | undefined
  private lastStreamAt = new Date(0).toISOString()
  private readonly breaker = new Map<string, BreakerState>()
  private metrics: BridgeMetrics = {
    bridge_foreign_bytes_in: 0,
    bridge_wenyan_bytes_archived: 0,
    bridge_information_loss_ratio: 0,
  }

  constructor(options: BridgeGatewayOptions) {
    this.config = options.bootstrap
    this.apiBaseUrl = options.apiBaseUrl ?? defaultApiBaseUrl(options.bootstrap)
    this.archive = options.archive ?? this.createArchiveFromBootstrap(this.config)
    this.adapters = options.adapters ?? this.config.bridge.adapters.map((cfg) => this.createAdapter(cfg))
    this.authHeader = `Bearer ${this.createBridgeToken()}`
  }

  async start (): Promise<void> {
    if (!this.config.bridge.enabled) return
    await this.ensureTargetGenres()
    const ctx: AdapterContext = {
      archive: this.archive,
      onInbound: this.onInbound.bind(this),
    }
    for (const adapter of this.adapters) {
      await adapter.start(ctx)
      this.breaker.set(adapter.id, { outcomes: [], pausedUntil: 0 })
    }
    if (this.config.bridge.sync.mode !== 'push') {
      this.pollTimer = setInterval(() => {
        void this.syncOnce().catch(() => undefined)
      }, this.config.bridge.sync.poll_interval_ms)
    }
    await this.syncOnce()
  }

  async stop (): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = undefined
    for (const adapter of this.adapters) await adapter.stop()
  }

  async status (): Promise<{
    running: boolean
    adapters: Array<{ id: string; protocol: BridgeProtocol; ok: boolean; detail?: string }>
    metrics: BridgeMetrics
  }> {
    const statuses: Array<{ id: string; protocol: BridgeProtocol; ok: boolean; detail?: string }> = []
    for (const adapter of this.adapters) {
      const health = await adapter.health()
      statuses.push({ id: adapter.id, protocol: adapter.protocol, ok: health.ok, detail: health.detail })
    }
    return {
      running: this.config.bridge.enabled,
      adapters: statuses,
      metrics: this.metrics,
    }
  }

  async dryRun (adapterId: string, payload: unknown): Promise<MessageEnvelope> {
    const adapter = this.adapters.find((a) => a.id === adapterId)
    if (!adapter) throw new Error(`bridge adapter not found: ${adapterId}`)
    const metadata: ForeignMetadata = {
      protocol: adapter.protocol,
      adapterId,
      headers: {},
      subjectOrTopic: adapter.protocol,
      timestampIso: nowIso(),
    }
    const idempotencyKey = adapter.into.extractIdempotencyKey(payload, metadata)
    const translated = adapter.into.translate(payload, metadata)
    if (!translated.ok) throw new Error(`dry-run translation failed: ${translated.error.code}`)
    return sanitizedEnvelope(translated.document, idempotencyKey)
  }

  async syncOnce (targetAdapterId?: string): Promise<{ pushed: number }> {
    if (!this.config.bridge.enabled) return { pushed: 0 }
    await this.captureOutboundEvents()
    const queue = await this.archive.dequeueBridgeOutbound(nowIso(), this.config.bridge.sync.batch_size)
    let pushed = 0
    for (const item of queue) {
      if (targetAdapterId && targetAdapterId !== item.adapterId) continue
      const adapter = this.adapters.find((a) => a.id === item.adapterId)
      if (!adapter) {
        await this.archive.markBridgeOutboundResult(item.id, 'failed', 'adapter-not-found')
        continue
      }
      if (this.isBreakerOpen(adapter.id)) {
        await this.archive.markBridgeOutboundResult(item.id, 'failed', 'circuit-open')
        continue
      }
      try {
        const message = await this.fetchMessage(item.messageId)
        if (!message) {
          await this.archive.markBridgeOutboundResult(item.id, 'failed', 'message-not-found')
          this.recordFailure(adapter.id)
          continue
        }
        const { foreignId } = await adapter.publishOutbound(message)
        await this.archive.upsertForeignSyncState({
          documentId: message.id,
          adapterId: adapter.id,
          adapterProtocol: adapter.protocol,
          foreignId,
          lastSyncAt: nowIso(),
          conflictStatus: 'resolved',
        })
        await this.archive.markBridgeOutboundResult(item.id, 'sent')
        this.recordSuccess(adapter.id)
        pushed += 1
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'publish-failed'
        await this.archive.markBridgeOutboundResult(item.id, 'failed', reason)
        await this.archive.appendBridgeDeadLetter({
          adapterId: item.adapterId,
          messageId: item.messageId,
          payloadJson: JSON.stringify({ messageId: item.messageId, adapterId: item.adapterId }),
          reason,
          attempts: item.attempts + 1,
          nextRetryAt: new Date(Date.now() + this.config.bridge.circuit_breaker.cool_down_ms).toISOString(),
          createdAt: nowIso(),
        })
        this.recordFailure(adapter.id)
      }
    }
    return { pushed }
  }

  private async onInbound (adapter: BridgeAdapter, payload: unknown, metadata: ForeignMetadata): Promise<void> {
    let safeMetadata: ForeignMetadata
    try {
      safeMetadata = sanitizeForeignMetadata(metadata)
    } catch (error) {
      await this.archive.appendForeignRejected({
        adapterId: adapter.id,
        reasonCode: 'invalid-foreign-metadata',
        reasonDetail: error instanceof Error ? error.message : 'invalid-foreign-metadata',
        payloadJson: JSON.stringify(payload),
        foreignId: undefined,
        receivedAt: nowIso(),
      })
      return
    }

    const provenanceOk = await adapter.into.verifyProvenance(payload, safeMetadata)
    if (!provenanceOk) {
      await this.archive.appendForeignRejected({
        adapterId: adapter.id,
        reasonCode: 'untrusted-provenance',
        reasonDetail: `publisher is not attested for adapter ${adapter.id}`,
        payloadJson: JSON.stringify(payload),
        foreignId: undefined,
        receivedAt: nowIso(),
      })
      return
    }

    const idempotencyKey = adapter.into.extractIdempotencyKey(payload, safeMetadata)
    const translated = adapter.into.translate(payload, safeMetadata)
    if (!translated.ok) {
      await this.archive.appendForeignRejected({
        adapterId: adapter.id,
        reasonCode: translated.error.code,
        reasonDetail: translated.error.message,
        payloadJson: JSON.stringify(payload),
        foreignId: idempotencyKey,
        receivedAt: nowIso(),
      })
      return
    }

    const foreignBytes = Buffer.byteLength(JSON.stringify({ payload, metadata: safeMetadata }), 'utf8')
    const clean = sanitizedEnvelope(translated.document, idempotencyKey)
    const wenyanBytes = Buffer.byteLength(JSON.stringify(clean), 'utf8')
    this.metrics.bridge_foreign_bytes_in += foreignBytes
    this.metrics.bridge_wenyan_bytes_archived += wenyanBytes
    this.metrics.bridge_information_loss_ratio =
      this.metrics.bridge_foreign_bytes_in === 0
        ? 0
        : (this.metrics.bridge_foreign_bytes_in - this.metrics.bridge_wenyan_bytes_archived) / this.metrics.bridge_foreign_bytes_in

    const res = await fetch(`${this.apiBaseUrl}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: this.authHeader },
      body: JSON.stringify(clean),
    })
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
    if (!res.ok) {
      await this.archive.appendForeignRejected({
        adapterId: adapter.id,
        reasonCode: 'gateway-rejected',
        reasonDetail: json.error ?? `status-${res.status}`,
        payloadJson: JSON.stringify(payload),
        foreignId: idempotencyKey,
        receivedAt: nowIso(),
      })
      return
    }

    const messageId = json.id ?? clean.id
    await this.archive.upsertForeignSyncState({
      documentId: messageId,
      adapterId: adapter.id,
      adapterProtocol: adapter.protocol,
      foreignId: idempotencyKey,
      lastSyncAt: nowIso(),
      conflictStatus: 'resolved',
    })
  }

  private async ensureTargetGenres (): Promise<void> {
    for (const adapter of this.config.bridge.adapters) {
      if (adapter.target_genre === 'edict' || adapter.target_genre === 'ti_definition') continue
      const schema = await this.archive.getCurrentTiDefinition(adapter.target_genre)
      if (!schema) throw new Error(`bridge target genre undefined: ${adapter.target_genre}`)
    }
  }

  private createAdapter (config: BridgeAdapterConfig): BridgeAdapter {
    if (config.protocol === 'nats') return new NatsBridgeAdapter(config)
    if (config.protocol === 'kafka') return new KafkaBridgeAdapter(config)
    if (config.protocol === 'mqtt') return new MqttBridgeAdapter(config)
    if (config.protocol === 'erp') return new ErpBridgeAdapter(config)
    if (config.protocol === 'payroll') return new PayrollBridgeAdapter(config)
    return new RegulatoryBridgeAdapter(config)
  }

  private createArchiveFromBootstrap (config: BridgeBootstrapConfig): ArchiveRepository {
    if (config.archive.engine !== 'sqlite') {
      throw new Error('bridge standalone runtime currently supports sqlite archive only')
    }
    const repo = new SqliteArchiveRepository(config.archive.path)
    repo.initialize()
    repo.migrate()
    return repo
  }

  private async captureOutboundEvents (): Promise<void> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/stream/replay?since=${encodeURIComponent(this.lastStreamAt)}`, {
        headers: { authorization: this.authHeader },
      })
      if (!res.ok) return
      const body = (await res.json()) as { events?: Array<{ at: string; type: string; messageId: string }> }
      const events = body.events ?? []
      for (const event of events) {
        this.lastStreamAt = event.at
        if (event.type !== 'archive.appended' && event.type !== 'transition.committed') continue
        const message = await this.fetchMessage(event.messageId)
        if (!message) continue
        for (const adapter of this.adapters) {
          if (!matchesRoutingTarget(message, adapter)) continue
          await this.archive.enqueueBridgeOutbound(adapter.id, event.messageId, nowIso())
        }
      }
    } catch {
      // Stream endpoint may be temporarily unavailable in standalone bridge mode.
      // Outbound sync will retry on the next polling cycle.
    }
  }

  private async fetchMessage (id: string): Promise<MessageEnvelope | undefined> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/messages/${id}`)
      if (!res.ok) {
        const retry = await fetch(`${this.apiBaseUrl}/messages/${id}`, {
          headers: { authorization: this.authHeader },
        })
        if (!retry.ok) return undefined
        const retryJson = (await retry.json()) as { message?: MessageEnvelope }
        return retryJson.message
      }
      const json = (await res.json()) as { message?: MessageEnvelope }
      return json.message
    } catch {
      return undefined
    }
  }

  private createBridgeToken (): string {
    const now = Math.floor(Date.now() / 1000)
    const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = encodeBase64Url(
      JSON.stringify({
        iss: this.config.auth.jwt_issuer,
        aud: this.config.auth.jwt_audience,
        sub: 'wenyan-bridge',
        role: 'genesis_admin',
        iat: now,
        exp: now + 3600,
      }),
    )
    const secret = this.config.auth.jwt_secret ?? 'wenyan-local-jwt-secret'
    const sig = createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    return `${header}.${payload}.${sig}`
  }

  private recordSuccess (adapterId: string): void {
    const state = this.breaker.get(adapterId)
    if (!state) return
    state.outcomes.push(true)
    if (state.outcomes.length > 100) state.outcomes.shift()
  }

  private recordFailure (adapterId: string): void {
    const state = this.breaker.get(adapterId)
    if (!state) return
    state.outcomes.push(false)
    if (state.outcomes.length > 100) state.outcomes.shift()
    const failures = state.outcomes.filter((x) => !x).length
    const rate = state.outcomes.length === 0 ? 0 : failures / state.outcomes.length
    if (rate > this.config.bridge.circuit_breaker.failure_rate_threshold) {
      state.pausedUntil = Date.now() + this.config.bridge.circuit_breaker.cool_down_ms
    }
  }

  private isBreakerOpen (adapterId: string): boolean {
    const state = this.breaker.get(adapterId)
    if (!state) return false
    if (state.pausedUntil <= Date.now()) return false
    return true
  }
}
