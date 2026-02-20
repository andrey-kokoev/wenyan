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
