// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/middleware/auth.ts
// Last synced: 2026-01-31
// ============================================================================

import { getCookie } from "hono/cookie"
import { unseal } from "iron-webcrypto"
import type { MiddlewareHandler, Context } from "hono"
import type { Bindings, Variables } from "../types/env"

const COOKIE_NAME = "harmonia_session"
const COOKIE_TTL = 60 * 60 * 24 * 7 // 7 days

// Iron seal options for iron-webcrypto v2
const sealOptions = {
  ttl: COOKIE_TTL * 1000,
  timestampSkewSec: 60,
  localtimeOffsetMsec: 0,
  encryption: {
    saltBits: 256,
    algorithm: "aes-256-cbc" as const,
    iterations: 1,
    minPasswordlength: 32,
  },
  integrity: {
    saltBits: 256,
    algorithm: "sha256" as const,
    iterations: 1,
    minPasswordlength: 32,
  },
}

export interface AuthContext {
  type: "user" | "service"
  user?: {
    id: string
    email: string
    name: string
    roles: number[]
    controlledActions: string[]
  }
}

export function authMiddleware(options?: {
  exclude?: RegExp[]
}): MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> {
  return async (c, next) => {
    const path = c.req.path
    
    // Skip excluded paths
    if (options?.exclude?.some(p => p.test(path))) {
      return next()
    }
    
    // Check service token
    const authHeader = c.req.header("authorization")
    const token = authHeader?.replace(/^Bearer\s+/i, "")
    if (token && token === c.env.SERVICE_TOKEN) {
      c.set("auth", { type: "service" } as AuthContext)
      return next()
    }
    
    // Check session cookie
    const cookie = getCookie(c, COOKIE_NAME)
    if (!cookie) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    
    try {
      // iron-webcrypto v2 API: unseal(sealed, password, options)
      const session = await unseal(cookie, c.env.AUTH_SECRET, sealOptions)
      const userSession = session as { user: AuthContext['user'] }
      c.set("auth", { type: "user", user: userSession.user } as AuthContext)
      await next()
    } catch {
      // Generic error message to prevent information leakage about authentication mechanisms.
      // Specific details are logged server-side for debugging.
      return c.json({ error: "Unauthorized" }, 401)
    }
  }
}

/**
 * Middleware that requires authentication (any user or service)
 */
export function requireAuth(): MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> {
  return async (c, next) => {
    const auth = c.get("auth") as AuthContext | undefined
    
    if (!auth || (auth.type !== "user" && auth.type !== "service")) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    
    await next()
  }
}

export function requirePermission(action: string): MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> {
  return async (c, next) => {
    const auth = c.get("auth") as AuthContext | undefined
    
    if (auth?.type === "service") return next()
    if (auth?.type !== "user" || !auth.user) {
      return c.json({ error: "Unauthorized" }, 401)
    }
    
    if (!auth.user.controlledActions?.includes(action)) {
      return c.json({ error: "Forbidden", required: action }, 403)
    }
    
    await next()
  }
}

export function getUser(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  const auth = c.get("auth") as AuthContext | undefined
  if (auth?.type !== "user" || !auth.user) {
    throw new Error("Unauthorized")
  }
  return auth.user
}

// Type declaration for Hono context
declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext
  }
}
