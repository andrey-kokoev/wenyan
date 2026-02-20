// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/auth/session.ts
// Last synced: 2026-01-31
// ============================================================================

import { seal, unseal } from "iron-webcrypto"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import type { Context } from "hono"
import type { UserSession } from "./types"
import type { Bindings, Variables } from "../types/env"

const COOKIE_NAME = "harmonia_session"
const COOKIE_TTL = 60 * 60 * 24 * 7 // 7 days

// Iron seal options for iron-webcrypto v2
const sealOptions = {
  ttl: COOKIE_TTL * 1000, // iron-webcrypto uses milliseconds
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

export async function setUserSession(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  session: UserSession
): Promise<void> {
  if (!c.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET environment variable is not set")
  }
  
  const sealed = await seal(
    session,
    c.env.AUTH_SECRET,
    sealOptions
  )
  
  setCookie(c, COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: c.req.url.startsWith("https://"),
    sameSite: "Lax",
    maxAge: COOKIE_TTL,
    path: "/",
  })
}

export async function getUserSession(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
): Promise<UserSession | null> {
  const cookie = getCookie(c, COOKIE_NAME)
  if (!cookie) return null
  
  try {
    return await unseal(
      cookie,
      c.env.AUTH_SECRET,
      sealOptions
    ) as UserSession
  } catch {
    return null
  }
}

export async function clearUserSession(c: Context): Promise<void> {
  deleteCookie(c, COOKIE_NAME)
}

export async function requireUserSession(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
): Promise<UserSession> {
  const session = await getUserSession(c)
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}
