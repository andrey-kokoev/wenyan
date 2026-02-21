// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/types/env.ts
// Last synced: 2026-01-31
// ============================================================================

/**
 * Cloudflare Worker environment bindings
 */
export interface Bindings {
  // Environment
  ENVIRONMENT: string
  
  // Microsoft OAuth
  AUTH_MICROSOFT_CLIENT_ID: string
  AUTH_MICROSOFT_CLIENT_SECRET: string
  AUTH_MICROSOFT_TENANT: string
  AUTH_MICROSOFT_REDIRECT_URL: string
  
  // Session encryption
  AUTH_SECRET: string
  
  // Service-to-service auth
  SERVICE_TOKEN?: string
  
  // Cloudflare bindings
  KV: KVNamespace
  DB: D1Database
  BLOB: R2Bucket
  DOCX_CONVERSION_PRODUCER: Fetcher
  HTTP_JOB_PRODUCER: Fetcher
  AI: any // Cloudflare Workers AI binding

  // AI Configuration
  AI_MODEL?: string // Default: @cf/meta/llama-3.1-8b-instruct
  ANTHROPIC_MODEL?: string // Anthropic model override

  // Frontend URL
  FRONTEND_URL?: string // Frontend URL for redirects

  // Wenyan bootstrap/runtime override vars
  WENYAN_ARCHIVE_ENGINE?: "sqlite" | "cloudflare"
  WENYAN_ARCHIVE_PATH?: string
  WENYAN_LAW_MODE?: "strict"
  WENYAN_LAW_CACHE_TTL_SECONDS?: string
  WENYAN_LAW_PRELOAD_TYPES?: string
  WENYAN_NODE_ID?: string
  WENYAN_GENESIS_KEY?: string
  WENYAN_GATEWAY_HOST?: string
  WENYAN_GATEWAY_PORT?: string
  WENYAN_UPSTREAM?: string
  WENYAN_AUTH_JWT_ISSUER?: string
  WENYAN_AUTH_JWT_AUDIENCE?: string
  WENYAN_AUTH_JWT_SECRET?: string
  WENYAN_AUTH_ALLOW_HEADER_ACTOR?: string
  WENYAN_CAPABILITY_SECRET?: string
  WENYAN_DISTRIBUTED_MODE?: "single" | "consort"
  WENYAN_DISTRIBUTED_NODE_ID?: string
  WENYAN_DISTRIBUTED_BIND_GOSSIP?: string
  WENYAN_DISTRIBUTED_SEEDS?: string
  WENYAN_DISTRIBUTED_FANOUT?: string
  WENYAN_DISTRIBUTED_SUSPICION_TIMEOUT_MS?: string
  WENYAN_CONSENSUS_KIND?: "none" | "pbft"
  WENYAN_CONSENSUS_REPLICA_SET?: string
  WENYAN_CONSENSUS_THRESHOLD?: string
  WENYAN_CONSENSUS_VIEW_CHANGE_TIMEOUT_MS?: string
  WENYAN_SYNC_BATCH_SIZE?: string
  WENYAN_SYNC_MAX_INFLIGHT?: string
  WENYAN_SYNC_RETRY_BACKOFF_MS?: string
  WENYAN_BRIDGE_ENABLED?: string
  WENYAN_BRIDGE_MODE?: "embedded" | "standalone"
  WENYAN_BRIDGE_ADAPTERS_JSON?: string
  WENYAN_BRIDGE_SYNC_MODE?: "poll" | "push" | "hybrid"
  WENYAN_BRIDGE_SYNC_POLL_INTERVAL_MS?: string
  WENYAN_BRIDGE_SYNC_BATCH_SIZE?: string
  WENYAN_BRIDGE_BREAKER_FAILURE_RATE?: string
  WENYAN_BRIDGE_BREAKER_COOL_DOWN_MS?: string
  WENYAN_BRIDGE_BREAKER_MAX_RETRIES?: string
  WENYAN_METRICS_ENABLED?: string
}

/**
 * Hono context variables (set by middleware)
 */
export interface Variables {
  requestId: string
  auth?: {
    type: 'user' | 'service'
    user?: {
      id: string
      email: string
      name: string
      roles: number[]
      controlledActions: string[]
    }
  }
}

// Alias for compatibility
export type Env = Bindings
