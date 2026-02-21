import { Hono } from 'hono'
import { TiResolver, type ArchiveRepository } from '@wenyan/archive'
import { constitutionalMerkleRoot, type ChannelEvent } from '@wenyan/channel'
import { canDraftGenre, EmergencyRouter, isImperialWorksGenre } from '@wenyan/imperial-works'
import {
  AccessControlLawContentSchema,
  AdmissionLawContentSchema,
  ProtocolLawContentSchema,
  validateEdict,
  validateEnvelope,
  validateTiDefinition,
  type EdictLawType,
  type LawMode,
} from '@wenyan/core'
import { InsufficientImperialAuthorityError, type SealContext } from '@wenyan/seal'
import {
  LawResolver,
  SealInvalidError,
  finalizePendingMessage,
  loadLawContent,
  processDocketMessage,
  type LawResolverEvent,
} from '@wenyan/pipeline'
import { AnomalyDetector, AuditService, CheckpointService, WenyanTracer } from '@wenyan/censorate'

const MAX_JSON_BODY_BYTES = 256 * 1024
const MAX_HEADER_VALUE_BYTES = 8 * 1024
const MAX_TOTAL_HEADER_BYTES = 32 * 1024
const UTF8_ENCODER = new TextEncoder()

function isZodLikeError(error: unknown): error is { issues: unknown[] } {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'issues' in error &&
      Array.isArray((error as { issues?: unknown[] }).issues),
  )
}

function headersWithinLimits(headers: Headers): boolean {
  let total = 0
  for (const [k, v] of headers.entries()) {
    const kb = UTF8_ENCODER.encode(k).length
    const vb = UTF8_ENCODER.encode(v).length
    total += kb + vb
    if (vb > MAX_HEADER_VALUE_BYTES) return false
    if (total > MAX_TOTAL_HEADER_BYTES) return false
  }
  return true
}

function contentLengthWithinLimit(headers: Headers): boolean {
  const raw = headers.get('content-length')
  if (!raw) return true
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return false
  return n <= MAX_JSON_BODY_BYTES
}

class SchemaUndefinedError extends Error {
  constructor(readonly genre: string) {
    super('genre-schema-missing')
    this.name = 'SchemaUndefinedError'
  }
}

function requiredOffices(message: { payload: Record<string, unknown> }): string[] {
  const routing = message.payload.routing as { destination?: unknown } | undefined
  if (Array.isArray(routing?.destination)) return routing.destination.map(String)
  if (typeof routing?.destination === 'string') return [routing.destination]
  return []
}

export interface GatewayRuntimeOptions {
  lawMode?: LawMode
  distributedMode?: 'single' | 'consort'
  consensusKind?: 'none' | 'pbft'
  pbftConsensus?: {
    proposeTiDefinition(proposalId: string, leaderNodeId: string): unknown
    onPrepare(msg: {
      proposalId: string
      viewNo: number
      nodeId: string
      phase: 'prepare'
      signature: string
      at: string
    }): boolean | Promise<boolean>
    onCommit(msg: {
      proposalId: string
      viewNo: number
      nodeId: string
      phase: 'commit'
      signature: string
      at: string
    }): boolean | Promise<boolean>
    commitIfThreshold(proposalId: string): boolean
    currentView(): number
  }
  nodeId?: string
  lawCacheTtlSeconds?: number
  lawPreloadTypes?: EdictLawType[]
  onLawEvent?: (event: LawResolverEvent) => void
  lawResolver?: LawResolver
  onMeshJoin?: (peer: string) => Promise<{ ok: boolean; detail?: string }> | { ok: boolean; detail?: string }
  onMeshSync?: (
    peer: string,
    fromCursor: string,
    limit: number,
  ) => Promise<{ ok: boolean; fetched: number; error?: string }> | { ok: boolean; fetched: number; error?: string }
  meshMembers?: () => Array<{ nodeId: string; address: string; state: string }>
  meshPartitioned?: () => boolean
  onSealGossip?: (messageId: string, sealSeq: number) => void | Promise<void>
  workerPollIntervalMs?: number
  auth?: {
    jwtIssuer?: string
    jwtAudience?: string
    jwtAlg?: 'HS256'
    jwtSecret?: string
    allowHeaderActor?: boolean
  }
}

async function validateByArchivedTi(
  tiResolver: TiResolver,
  message: ReturnType<typeof validateEnvelope>,
  options: { requireDefinedGenreSchema?: boolean } = {},
) {
  if (message.genre === 'ti_definition') {
    validateTiDefinition(message)
    return
  }
  if (message.genre === 'edict') {
    validateEdict(message)
    return
  }

  const ti = await tiResolver.getCurrentTiDefinition(message.genre)
  if (!ti) {
    if (options.requireDefinedGenreSchema) {
      throw new SchemaUndefinedError(message.genre)
    }
    return
  }
  const schema = ti.schema
  const required = Array.isArray(schema.required) ? schema.required : []
  for (const key of required) {
    if (typeof key === 'string' && !(key in message.payload)) {
      throw new Error('schema-noncompliant')
    }
  }
}

async function admissionCheck(
  resolver: LawResolver,
  message: ReturnType<typeof validateEnvelope>,
): Promise<void> {
  if (message.genre === 'ti_definition' || message.genre === 'edict') {
    return
  }

  const law = await loadLawContent({
    resolver,
    lawType: 'admission',
    schema: AdmissionLawContentSchema,
    strictErrors: {
      missing: 'law-missing-admission',
      ambiguous: 'law-ambiguous-admission',
      invalid: 'law-invalid-admission',
    },
  })
  if (!law.ok) {
    throw new Error(law.error)
  }
  if (!law.content) return

  const allowed = law.content.allowed_genres
  if (!allowed.includes('*') && !allowed.includes(message.genre)) {
    throw new Error('genre-not-admitted')
  }
}

async function protocolRequiredAcks(resolver: LawResolver, message: { genre: string; payload: Record<string, unknown> }): Promise<number> {
  const base = requiredOffices(message).length || 1
  const law = await loadLawContent({
    resolver,
    lawType: 'protocol',
    schema: ProtocolLawContentSchema,
    strictErrors: {
      missing: 'law-missing-protocol',
      ambiguous: 'law-ambiguous-protocol',
      invalid: 'law-invalid-protocol',
    },
  })
  if (!law.ok) {
    throw new Error(law.error)
  }
  if (!law.content) return base
  return law.content.required_acks_by_genre[message.genre] ?? base
}

export async function tongzhengSi(
  tiResolver: TiResolver,
  resolver: LawResolver,
  input: unknown,
) {
  const message = validateEnvelope(input)
  await validateByArchivedTi(tiResolver, message, { requireDefinedGenreSchema: true })
  await admissionCheck(resolver, message)
  return message
}

type RepoFactory = ArchiveRepository | (() => ArchiveRepository | Promise<ArchiveRepository>)

interface ChannelLike {
  subscribe(fn: (event: ChannelEvent) => void): () => void
  publish(event: ChannelEvent): boolean
  replay(sinceIso: string): ChannelEvent[]
}

async function resolveRepo(repoFactory: RepoFactory): Promise<ArchiveRepository> {
  if (typeof repoFactory === 'function') return repoFactory()
  return repoFactory
}

interface ReadActor {
  id: string
  role: string
}

interface GatewayAuthConfig {
  jwtIssuer: string
  jwtAudience: string
  jwtAlg: 'HS256'
  jwtSecret?: string
  allowHeaderActor: boolean
}

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(padded, 'base64'))
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function decodeJsonBase64Url(input: string): Record<string, unknown> | undefined {
  try {
    const bytes = decodeBase64Url(input)
    const text = typeof TextDecoder !== 'undefined'
      ? new TextDecoder().decode(bytes)
      : String.fromCharCode(...bytes)
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

async function verifyJwtHs256(
  token: string,
  secret: string,
): Promise<{ ok: true; claims: Record<string, unknown> } | { ok: false }> {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false }
  const [headEnc, bodyEnc, sigEnc] = parts
  const header = decodeJsonBase64Url(headEnc)
  const claims = decodeJsonBase64Url(bodyEnc)
  if (!header || !claims) return { ok: false }
  if (header.alg !== 'HS256' || header.typ !== 'JWT') return { ok: false }
  if (typeof crypto === 'undefined' || !crypto.subtle) return { ok: false }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headEnc}.${bodyEnc}`)),
  )
  const provided = decodeBase64Url(sigEnc)
  if (!timingSafeEqualBytes(signature, provided)) return { ok: false }
  return { ok: true, claims }
}

async function actorFromHeaders(
  headers: Headers,
  authConfig: GatewayAuthConfig,
): Promise<{ actor?: ReadActor; reason?: string }> {
  const headerActorId = headers.get('x-wenyan-actor-id') ?? undefined
  const headerActorRole = headers.get('x-wenyan-actor-role') ?? undefined
  const isTestMode =
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
    (typeof process !== 'undefined' && process.env.WENYAN_ALLOW_HEADER_ACTOR === 'true')
  if (authConfig.allowHeaderActor && isTestMode && headerActorId && headerActorRole) {
    return { actor: { id: headerActorId, role: headerActorRole } }
  }
  const auth = headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return { reason: 'read-unauthenticated' }
  const token = auth.slice('Bearer '.length).trim()
  if (!token) return { reason: 'read-unauthenticated' }
  if (authConfig.jwtAlg !== 'HS256' || !authConfig.jwtSecret) {
    return { reason: 'auth-config-invalid' }
  }
  const verified = await verifyJwtHs256(token, authConfig.jwtSecret)
  if (!verified.ok) return { reason: 'read-unauthenticated' }
  const claims = verified.claims
  if (claims.iss !== authConfig.jwtIssuer || claims.aud !== authConfig.jwtAudience) {
    return { reason: 'read-unauthenticated' }
  }
  const now = Math.floor(Date.now() / 1000)
  const iat = typeof claims.iat === 'number' ? claims.iat : undefined
  const exp = typeof claims.exp === 'number' ? claims.exp : undefined
  if (iat === undefined || iat > now + 30 || (exp !== undefined && exp < now)) {
    return { reason: 'read-unauthenticated' }
  }
  if (typeof claims.sub !== 'string' || typeof claims.role !== 'string') {
    return { reason: 'read-unauthenticated' }
  }
  return { actor: { id: claims.sub, role: claims.role } }
}

async function checkReadAccess(
  resolver: LawResolver,
  actor: ReadActor | undefined,
  genre: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const law = await loadLawContent({
    resolver,
    lawType: 'access_control',
    schema: AccessControlLawContentSchema,
    strictErrors: {
      missing: 'law-missing-access-control',
      ambiguous: 'law-ambiguous-access-control',
      invalid: 'law-invalid-access-control',
    },
  })

  if (!law.ok) {
    return { allowed: false, reason: law.error }
  }
  if (!law.content) {
    return { allowed: false, reason: 'law-missing-access-control' }
  }
  if (!actor) {
    return law.content.anonymous_read ? { allowed: true } : { allowed: false, reason: 'read-unauthenticated' }
  }

  const allowed = law.content.read_permissions[actor.role] ?? []
  if (allowed.includes('*') || allowed.includes(genre)) return { allowed: true }
  return { allowed: false, reason: 'read-forbidden' }
}

export function buildGateway(
  repoFactory: RepoFactory,
  channel: ChannelLike,
  sealContextInput: SealContext | (() => SealContext),
  options: GatewayRuntimeOptions = {},
) {
  const app = new Hono()
  let runtimeRepo: ArchiveRepository | undefined
  let runtimeResolver: LawResolver | undefined = options.lawResolver
  let runtimeTiResolver: TiResolver | undefined
  let runtimeTracer: WenyanTracer | undefined
  let runtimeAudit: AuditService | undefined
  let runtimeCheckpoint: CheckpointService | undefined
  let runtimeAnomaly: AnomalyDetector | undefined
  let runtimeEmergency: EmergencyRouter | undefined
  let workerInterval: ReturnType<typeof setInterval> | undefined
  let workerRunning = false
  const recentSeal6ByActor = new Map<string, number[]>()
  const quarantinedActors = new Set<string>()
  let constitutionalAmendmentInProgress = false
  const authConfig: GatewayAuthConfig = {
    jwtIssuer: options.auth?.jwtIssuer ?? 'wenyan.local',
    jwtAudience: options.auth?.jwtAudience ?? 'wenyan-gateway',
    jwtAlg: options.auth?.jwtAlg ?? 'HS256',
    jwtSecret: options.auth?.jwtSecret ?? 'wenyan-local-jwt-secret',
    allowHeaderActor: options.auth?.allowHeaderActor ?? false,
  }

  function currentSealContext(): SealContext {
    return typeof sealContextInput === 'function' ? sealContextInput() : sealContextInput
  }

  async function resolveRuntime(): Promise<{
    repo: ArchiveRepository
    resolver: LawResolver
    tiResolver: TiResolver
    tracer: WenyanTracer
    audit: AuditService
    checkpoint: CheckpointService
    anomaly: AnomalyDetector
    emergency: EmergencyRouter
  }> {
    const repo = await resolveRepo(repoFactory)
    if (!runtimeResolver || runtimeRepo !== repo) {
      runtimeResolver =
        options.lawResolver ??
        new LawResolver(repo, {
          mode: options.lawMode ?? 'strict',
          cacheTtlSeconds: options.lawCacheTtlSeconds ?? 60,
          preloadTypes: options.lawPreloadTypes,
          onEvent: options.onLawEvent,
        })
      runtimeRepo = repo
      runtimeTiResolver = new TiResolver(repo, { ttlSeconds: options.lawCacheTtlSeconds ?? 60 })
      runtimeTracer = new WenyanTracer('@wenyan/gateway')
      const defaultSecret = 'wenyan-seal0-local-secret'
      const runtimeSecret =
        typeof process !== 'undefined' && process?.env?.WENYAN_SEAL0_SECRET
          ? process.env.WENYAN_SEAL0_SECRET
          : defaultSecret
      runtimeAudit = new AuditService(repo, runtimeSecret)
      runtimeCheckpoint = new CheckpointService(repo)
      runtimeAnomaly = new AnomalyDetector(repo)
      runtimeEmergency = new EmergencyRouter(repo)
      await runtimeResolver.preload()
      if (!workerInterval) {
        const pollMs = Math.max(50, options.workerPollIntervalMs ?? 250)
        workerInterval = setInterval(() => {
          void processDocketLoop()
        }, pollMs)
      }
    }
    return {
      repo,
      resolver: runtimeResolver,
      tiResolver: runtimeTiResolver!,
      tracer: runtimeTracer!,
      audit: runtimeAudit!,
      checkpoint: runtimeCheckpoint!,
      anomaly: runtimeAnomaly!,
      emergency: runtimeEmergency!,
    }
  }

  async function processDocketLoop(): Promise<void> {
    if (workerRunning) return
    workerRunning = true
    try {
      const { repo, resolver, tiResolver, anomaly } = await resolveRuntime()
      while (true) {
        const item = await repo.dequeueDocket(new Date().toISOString())
        if (!item) break
        let result: { messageId: string; finalState: 'pending' | 'authorized' | 'rejected' | 'archived'; reason?: string }
        try {
          result = await processDocketMessage(repo, item.messageId, currentSealContext(), {
            lawResolver: resolver,
            lawMode: options.lawMode ?? 'strict',
            distributedMode: options.distributedMode ?? 'single',
            consensusKind: options.consensusKind ?? 'none',
            pbftConsensus: options.pbftConsensus,
            nodeId: options.nodeId,
            lawCacheTtlSeconds: options.lawCacheTtlSeconds ?? 60,
            lawPreloadTypes: options.lawPreloadTypes,
            onLawEvent: options.onLawEvent,
          })
        } catch (error) {
          const reason =
            error instanceof InsufficientImperialAuthorityError
              ? 'insufficient-imperial-authority'
              : error instanceof SealInvalidError
                ? 'invalid-seal-chain'
                : error instanceof Error && error.message
                  ? error.message
                  : 'processing-error'
          const nowIso = new Date().toISOString()
          const fromState = (await repo.snapshotState(item.messageId)) ?? 'pending'
          const transitions = await repo.getTransitions(item.messageId)
          if (fromState !== 'rejected') {
            await repo.appendTransition({
              messageId: item.messageId,
              fromState,
              toState: 'rejected',
              sequenceNo: transitions.length + 1,
              actorId: 'gateway-worker',
              sealedAt: nowIso,
              at: nowIso,
              prevTransitionHash: transitions.length > 0 ? transitions[transitions.length - 1].prevTransitionHash : 'GENESIS',
              reason,
            })
          }
          result = { messageId: item.messageId, finalState: 'rejected', reason }
        }
        const processed = await repo.getMessage(item.messageId)
        if (processed && item.messageId === processed.id && processed.genre === 'blueprint_change') {
          constitutionalAmendmentInProgress = result.finalState === 'pending'
        }
        if (processed && result.finalState === 'archived' && processed.genre === 'ti_definition') {
          const nowMs = Date.now()
          const actorId = processed.actor.id
          const samples = (recentSeal6ByActor.get(actorId) ?? []).filter((ts) => nowMs - ts < 60_000)
          samples.push(nowMs)
          recentSeal6ByActor.set(actorId, samples)
          const velocity = await anomaly.detectVelocity(
            samples.map((ts) => ({ actorId, timestampIso: new Date(ts).toISOString() })),
            10,
          )
          if (velocity?.action_taken === 'quarantine') {
            quarantinedActors.add(actorId)
          }
          const payload = processed.payload as Record<string, unknown>
          const targetGenre = typeof payload.target_genre === 'string' ? payload.target_genre : undefined
          tiResolver.invalidate(targetGenre)
        }
        if (processed && processed.genre === 'edict' && result.finalState === 'archived') {
          const payload = processed.payload as Record<string, unknown>
          const lawType = typeof payload.law_type === 'string' ? payload.law_type : undefined
          const knownLawTypes = new Set([
            'appointment',
            'classification',
            'routing',
            'admission',
            'protocol',
            'regulation',
            'access_control',
            'detection_rule',
          ])
          resolver.invalidate(knownLawTypes.has(String(lawType)) ? (lawType as EdictLawType) : undefined)
        }
        if ((options.distributedMode ?? 'single') === 'consort') {
          await options.onSealGossip?.(item.messageId, 5)
          if (result.finalState === 'archived') await options.onSealGossip?.(item.messageId, 6)
        }
        const transitions = await repo.getTransitions(item.messageId)
        const last = transitions[transitions.length - 1]
        if (last) {
          channel.publish({
            id: `${item.messageId}:${last.sequenceNo}`,
            type: result.finalState === 'rejected' ? 'message.rejected' : 'archive.appended',
            messageId: item.messageId,
            payload: { result },
            at: new Date().toISOString(),
          })
        }
      }
    } catch {
      // Background loop retries on next tick.
    } finally {
      workerRunning = false
    }
  }

  app.post('/messages', async (c) => {
    try {
      if (!headersWithinLimits(c.req.raw.headers)) {
        return c.json({ error: 'headers-too-large' }, 431)
      }
      if (!contentLengthWithinLimit(c.req.raw.headers)) {
        return c.json({ error: 'payload-too-large' }, 413)
      }
      const nowIso = new Date().toISOString()
      const idempotencyKey = c.req.header('x-idempotency-key')
      const { repo, resolver, tiResolver, tracer, anomaly, emergency } = await resolveRuntime()
      if (idempotencyKey) {
        const existing = await repo.getIdempotency(idempotencyKey, nowIso)
        if (existing) {
          return c.json(JSON.parse(existing.responseJson), 200)
        }
      }

      const body = await c.req.json()
      const message = await tracer.withSpan(
        'wenyan.gateway.submit',
        { 'wenyan.message_id': String((body as { id?: string })?.id ?? ''), 'wenyan.seal_type': 0 },
        async () => tongzhengSi(tiResolver, resolver, body),
      )

      if (isImperialWorksGenre(message.genre) && !canDraftGenre(message.actor.role, message.genre)) {
        return c.json({ error: 'hierarchy_violation' }, 403)
      }
      if (constitutionalAmendmentInProgress && message.genre === 'blueprint_change' && message.actor.role.startsWith('worker_')) {
        return c.json({ error: 'constitutional_amendment_in_progress' }, 403)
      }
      const siteStatus = await repo.getSiteStatus()
      if (siteStatus === 'QUARANTINED' && message.genre !== 'safety_incident' && message.genre !== 'edict') {
        return c.json({ error: 'site_quarantined' }, 423)
      }

      if (quarantinedActors.has(message.actor.id)) {
        return c.json({ error: 'actor-quarantined' }, 403)
      }

      const claimedTimestamp = (message.metadata as Record<string, unknown>).claimed_timestamp
      if (typeof claimedTimestamp === 'string') {
        const driftMs = Math.abs(new Date(claimedTimestamp).getTime() - Date.now())
        const temporal = await anomaly.detectTemporal(
          { nodeId: options.nodeId ?? 'local-node', claimedTimestampIso: claimedTimestamp, observedTimestampIso: new Date().toISOString() },
          5000,
        )
        if (temporal && driftMs > 5000) {
          return c.json({ error: 'temporal_anomaly' }, 422)
        }
      }

      const geo = (message.metadata as Record<string, unknown>).geography
      if (geo && typeof geo === 'object' && !Array.isArray(geo)) {
        const typed = geo as { actor_id?: unknown; from?: unknown; to?: unknown; distance_km?: unknown; delta_seconds?: unknown }
        if (
          typeof typed.actor_id === 'string' &&
          typeof typed.from === 'string' &&
          typeof typed.to === 'string' &&
          typeof typed.distance_km === 'number' &&
          typeof typed.delta_seconds === 'number'
        ) {
          const geographic = await anomaly.detectGeographic({
            actorId: typed.actor_id,
            from: typed.from,
            to: typed.to,
            distanceKm: typed.distance_km,
            deltaSeconds: typed.delta_seconds,
          })
          if (geographic) {
            quarantinedActors.add(typed.actor_id)
            return c.json({ error: 'geographic_impossibility' }, 422)
          }
        }
      }

      const coalition = (message.metadata as Record<string, unknown>).coalition
      if (coalition && typeof coalition === 'object' && !Array.isArray(coalition)) {
        const typed = coalition as {
          genre?: unknown
          offices?: unknown
          observed_probability?: unknown
          baseline_probability?: unknown
        }
        if (
          typeof typed.genre === 'string' &&
          Array.isArray(typed.offices) &&
          typeof typed.observed_probability === 'number' &&
          typeof typed.baseline_probability === 'number'
        ) {
          await anomaly.detectCoalition({
            genre: typed.genre,
            offices: typed.offices.map((x) => String(x)),
            observedProbability: typed.observed_probability,
            baselineProbability: typed.baseline_probability,
          })
        }
      }

      await repo.appendMessage(message)
      await repo.enqueueDocket(message.id)
      void processDocketLoop()

      if (message.genre === 'safety_incident') {
        await emergency.routeSafetyIncident({
          messageId: message.id,
          severity: String((message.payload as Record<string, unknown>).severity_level ?? 'critical') as 'low' | 'medium' | 'high' | 'critical',
          location: String((message.payload as Record<string, unknown>).location ?? 'unknown'),
          actorId: message.actor.id,
        })
      }

      const response = { id: message.id, acceptedAt: nowIso }
      if (idempotencyKey) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        await repo.putIdempotency(idempotencyKey, JSON.stringify(response), expiresAt)
      }

      c.header('location', `/api/wenyan/messages/${message.id}`)
      return c.json(response, 202)
    } catch (error) {
      if (isZodLikeError(error)) {
        return c.json({ error: 'invalid-payload', issues: error.issues }, 400)
      }
      if (error instanceof Error && error.message === 'schema-noncompliant') {
        return c.json({ error: 'schema-noncompliant' }, 400)
      }
      if (error instanceof SchemaUndefinedError) {
        return c.json({ error: 'Schema Undefined', genre: error.genre }, 503)
      }
      if (error instanceof Error && error.message === 'genre-not-admitted') {
        return c.json({ error: 'genre-not-admitted' }, 403)
      }
      if (error instanceof Error && error.message.startsWith('law-')) {
        return c.json({ error: error.message }, 503)
      }
      if (error instanceof InsufficientImperialAuthorityError) {
        return c.json({ error: 'insufficient-imperial-authority' }, 403)
      }
      if (error instanceof SealInvalidError) {
        return c.json({ error: 'invalid-seal-chain' }, 403)
      }
      return c.json({ error: 'internal-error' }, 500)
    }
  })

  app.post('/messages/:id/approvals', async (c) => {
    if (!headersWithinLimits(c.req.raw.headers)) {
      return c.json({ error: 'headers-too-large' }, 431)
    }
    if (!contentLengthWithinLimit(c.req.raw.headers)) {
      return c.json({ error: 'payload-too-large' }, 413)
    }
    const { repo, resolver } = await resolveRuntime()
    const id = c.req.param('id')
    const message = await repo.getMessage(id)
    if (!message) return c.json({ error: 'not-found' }, 404)

    const body = (await c.req.json()) as { office?: string }
    const office = body.office
    if (!office) return c.json({ error: 'office-required' }, 400)

    const requiredOfficesList = requiredOffices(message)
    if (!requiredOfficesList.includes(office)) {
      return c.json({ error: 'office-not-required' }, 400)
    }

    await repo.addOfficeApproval(id, office)
    const approvals = await repo.getOfficeApprovals(id)

    const requiredCount = await protocolRequiredAcks(resolver, message)
    if (approvals.length < requiredCount) {
      return c.json({ state: 'pending', approvals, required: requiredCount }, 200)
    }

    try {
      const result = await finalizePendingMessage(repo, id, currentSealContext(), {
        lawResolver: resolver,
        lawMode: options.lawMode ?? 'strict',
        distributedMode: options.distributedMode ?? 'single',
        consensusKind: options.consensusKind ?? 'none',
        pbftConsensus: options.pbftConsensus,
        nodeId: options.nodeId,
        lawCacheTtlSeconds: options.lawCacheTtlSeconds ?? 60,
        lawPreloadTypes: options.lawPreloadTypes,
        onLawEvent: options.onLawEvent,
      })
      return c.json({ state: result.finalState, approvals, required: requiredCount }, 200)
    } catch (error) {
      if (error instanceof InsufficientImperialAuthorityError) {
        return c.json({ error: 'insufficient-imperial-authority' }, 403)
      }
      if (error instanceof SealInvalidError) {
        return c.json({ error: 'invalid-seal-chain' }, 403)
      }
      if (error instanceof Error && error.message.startsWith('law-')) {
        return c.json({ error: error.message }, 503)
      }
      return c.json({ error: 'internal-error' }, 500)
    }
  })

  app.post('/emergency/safety-incident', async (c) => {
    const { repo, emergency } = await resolveRuntime()
    const body = (await c.req.json().catch(() => ({}))) as {
      id?: string
      severity?: 'low' | 'medium' | 'high' | 'critical'
      location?: string
      actorId?: string
    }
    if (!body.id) return c.json({ error: 'message-id-required' }, 400)
    const result = await emergency.routeSafetyIncident({
      messageId: body.id,
      severity: body.severity ?? 'critical',
      location: body.location ?? 'unknown',
      actorId: body.actorId ?? 'unknown',
    })
    await repo.setSiteStatus('QUARANTINED', `safety:${body.id}`)
    return c.json(result, 202)
  })

  app.get('/messages/:id', (c) => {
    const runtimePromise = resolveRuntime()
    return (async () => {
      const id = c.req.param('id')
      const { repo, resolver, audit, tracer } = await runtimePromise
      const message = await repo.getMessage(id)
      if (!message) {
        return c.json({ error: 'not-found' }, 404)
      }
      const auth = await actorFromHeaders(c.req.raw.headers, authConfig)
      const actor = auth.actor
      const access = await checkReadAccess(resolver, actor, message.genre)
      if (!access.allowed) {
        await audit.createReadReceipt({
          documentId: id,
          actorId: actor?.id ?? 'anonymous',
          genre: message.genre,
          queryParameters: { id },
          result: { denied: true },
          resultStatus: 'denied',
          reason: access.reason ?? auth.reason ?? 'read-forbidden',
          traceId: tracer.currentTrace()?.traceId,
          nodeId: options.nodeId,
        })
        return c.json({ error: 'forbidden', reason: access.reason ?? auth.reason ?? 'read-forbidden' }, 403)
      }
      const payload = {
        message,
        state: (await repo.snapshotState(id)) ?? 'pending',
        transitions: await repo.getTransitions(id),
        seals: await repo.getSeals(id),
        approvals: await repo.getOfficeApprovals(id),
      }
      await audit.createReadReceipt({
        documentId: id,
        actorId: actor?.id ?? 'anonymous',
        genre: message.genre,
        queryParameters: { id },
        result: payload,
        resultStatus: 'allowed',
        traceId: tracer.currentTrace()?.traceId,
        nodeId: options.nodeId,
      })
      return c.json({
        ...payload,
      })
    })()
  })

  app.get('/messages', (c) => {
    const runtimePromise = resolveRuntime()
    return (async () => {
      const state = c.req.query('state')
      const genre = c.req.query('genre')
      const auth = await actorFromHeaders(c.req.raw.headers, authConfig)
      const actor = auth.actor
      const { repo, resolver, audit, tracer } = await runtimePromise
      if (!state) {
        return c.json({ error: 'state-query-required' }, 400)
      }
      if (genre) {
        const access = await checkReadAccess(resolver, actor, genre)
        if (!access.allowed) {
          await audit.createReadReceipt({
            actorId: actor?.id ?? 'anonymous',
            genre,
            queryParameters: { state, genre },
            result: { denied: true },
            resultStatus: 'denied',
            reason: access.reason ?? auth.reason ?? 'read-forbidden',
            traceId: tracer.currentTrace()?.traceId,
            nodeId: options.nodeId,
          })
          return c.json({ error: 'forbidden', reason: access.reason ?? auth.reason ?? 'read-forbidden' }, 403)
        }
      }
      await audit.createReadReceipt({
        actorId: actor?.id ?? 'anonymous',
        genre: genre ?? undefined,
        queryParameters: { state, genre },
        result: { state, items: [] },
        resultStatus: 'allowed',
        traceId: tracer.currentTrace()?.traceId,
        nodeId: options.nodeId,
      })
      return c.json({ state, items: [] })
    })()
  })

  app.get('/stream', (c) => {
    const since = c.req.query('since') ?? new Date(Date.now() - 60_000).toISOString()
    const encoder = new TextEncoder()
    let unsubscribe: (() => void) | undefined
    let keepalive: ReturnType<typeof setInterval> | undefined
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: ChannelEvent): void => {
          controller.enqueue(
            encoder.encode(`id: ${event.id}\nevent: transition\ndata: ${JSON.stringify(event)}\n\n`),
          )
        }
        for (const event of channel.replay(since)) send(event)
        unsubscribe = channel.subscribe(send)
        keepalive = setInterval(() => {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        }, 15_000)
        const signal = c.req.raw.signal
        signal?.addEventListener('abort', () => {
          if (keepalive) clearInterval(keepalive)
          if (unsubscribe) unsubscribe()
          controller.close()
        })
      },
      cancel() {
        if (keepalive) clearInterval(keepalive)
        if (unsubscribe) unsubscribe()
      },
    })
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    })
  })

  app.get('/stream/replay', (c) => {
    const since = c.req.query('since') ?? new Date(Date.now() - 60_000).toISOString()
    return c.json({ events: channel.replay(since) })
  })

  app.get('/constitution/root', (c) => {
    const runtimePromise = resolveRuntime()
    return (async () => {
      const { repo } = await runtimePromise
      const root = await constitutionalMerkleRoot(repo)
      const count = (await repo.getConstitutionalDocuments()).length
      return c.json({ root, count })
    })()
  })

  app.get('/mesh/merkle-root', (c) => {
    if ((options.distributedMode ?? 'single') !== 'consort') {
      return c.json({ error: 'mesh-not-configured' }, 503)
    }
    const runtimePromise = resolveRuntime()
    return (async () => {
      const { repo } = await runtimePromise
      const root = await repo.getMerkleRoot('all')
      return c.json({ mode: options.distributedMode ?? 'single', root })
    })()
  })

  app.get('/mesh/status', (c) => {
    if ((options.distributedMode ?? 'single') !== 'consort') {
      return c.json({ error: 'mesh-not-configured' }, 503)
    }
    return c.json({
      mode: options.distributedMode ?? 'single',
      partitioned: options.meshPartitioned?.() ?? false,
      members: options.meshMembers?.() ?? [],
    })
  })

  app.post('/mesh/join', async (c) => {
    if ((options.distributedMode ?? 'single') !== 'consort') {
      return c.json({ error: 'mesh-not-configured' }, 503)
    }
    const body = (await c.req.json()) as { peer?: string }
    if (!body.peer) return c.json({ error: 'peer-required' }, 400)
    if (!options.onMeshJoin) return c.json({ error: 'mesh-not-configured' }, 503)
    const result = await options.onMeshJoin(body.peer)
    return c.json(result, result.ok ? 200 : 409)
  })

  app.post('/mesh/sync', async (c) => {
    if ((options.distributedMode ?? 'single') !== 'consort') {
      return c.json({ error: 'mesh-not-configured' }, 503)
    }
    const runtimePromise = resolveRuntime()
    const body = (await c.req.json()) as { peer?: string; fromCursor?: string; limit?: number }
    if (!body.peer) return c.json({ error: 'peer-required' }, 400)
    const fromCursor = body.fromCursor ?? '0'
    const limit = Number.isFinite(body.limit) ? Number(body.limit) : 200
    if (body.peer === 'local' || !options.onMeshSync) {
      const { repo } = await runtimePromise
      const transitions = await repo.getSyncRange(fromCursor, limit)
      return c.json({ ok: true, transitions }, 200)
    }
    const result = await options.onMeshSync(body.peer, fromCursor, limit)
    return c.json(result, result.ok ? 200 : 409)
  })

  app.get('/audit/who-read', async (c) => {
    const { repo } = await resolveRuntime()
    const documentId = c.req.query('document')
    const genre = c.req.query('genre')
    const since = c.req.query('since') ?? undefined
    const actorId = c.req.query('actor') ?? undefined
    const limit = Number(c.req.query('limit') ?? '100')
    if (!documentId && !genre) return c.json({ error: 'document-or-genre-required' }, 400)
    const items = documentId
      ? await repo.querySeal0ByDocument(documentId, { since, actorId, limit })
      : await repo.querySeal0ByGenre(genre!, { since, actorId, limit })
    return c.json({ items }, 200)
  })

  app.get('/audit/anomaly', async (c) => {
    const { repo } = await resolveRuntime()
    const since = c.req.query('since') ?? undefined
    const type = c.req.query('type') ?? undefined
    const limit = Number(c.req.query('limit') ?? '100')
    const items = await repo.queryCensorateAlerts({ since, type, limit })
    return c.json({ items }, 200)
  })

  app.get('/audit/trace/:id', async (c) => {
    const { repo } = await resolveRuntime()
    const id = c.req.param('id')
    const message = await repo.getMessage(id)
    if (!message) return c.json({ error: 'not-found' }, 404)
    const transitions = await repo.getTransitions(id)
    const seals = await repo.getSeals(id)
    return c.json({
      messageId: id,
      spans: [
        { name: 'wenyan.pipeline.caoni', count: 1 },
        { name: 'wenyan.pipeline.shenfu', count: 1 },
        { name: 'wenyan.pipeline.pizhun', count: 1 },
        { name: 'wenyan.archive.commit', count: transitions.length + seals.length },
      ],
      transitions,
      seals,
    })
  })

  app.get('/audit/export', async (c) => {
    const { checkpoint } = await resolveRuntime()
    const start = c.req.query('start') ?? undefined
    const end = c.req.query('end') ?? undefined
    const merkleRoot = c.req.query('merkle_root') ?? undefined
    const bundle = await checkpoint.exportBundle({ start, end, merkleRoot })
    return c.json(bundle, 200)
  })

  app.post('/audit/checkpoint', async (c) => {
    const { checkpoint } = await resolveRuntime()
    const body = (await c.req.json().catch(() => ({}))) as { scope?: 'all' | 'constitutional' | 'legislative'; signatures?: string[]; sealCount?: number }
    const created = await checkpoint.createCheckpoint(body.scope ?? 'all', body.signatures ?? [], body.sealCount ?? 0)
    return c.json(created, 201)
  })

  return app
}
