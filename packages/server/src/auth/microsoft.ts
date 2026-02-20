// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/auth/microsoft.ts
// Last synced: 2026-01-31
// ============================================================================

import { MicrosoftEntraId } from "arctic"
import { generateState, generateCodeVerifier } from "arctic"
import { getCookie, setCookie } from "hono/cookie"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { normalizeEmail } from "./email"
import { checkAccess } from "./db"
import { setUserSession } from "./session"
import { ensurePersonalWorkspace } from "../utils/workspaces"
import * as schema from "./schema"
import type { Bindings, Variables } from "../types/env"

/**
 * Get the frontend URL from environment or fallback to defaults
 */
function getFrontendUrl(env: Bindings): string {
  if (env.FRONTEND_URL) {
    return env.FRONTEND_URL;
  }
  return env.ENVIRONMENT === "development"
    ? "http://localhost:5175"
    : "https://harmonia.andrei-kokoev.workers.dev";
}

export async function initiateMicrosoftAuth(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  returnTo?: string
): Promise<Response> {
  const microsoft = new MicrosoftEntraId(
    c.env.AUTH_MICROSOFT_TENANT || "organizations",
    c.env.AUTH_MICROSOFT_CLIENT_ID,
    c.env.AUTH_MICROSOFT_CLIENT_SECRET,
    c.env.AUTH_MICROSOFT_REDIRECT_URL
  )
  
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  
  const url = await microsoft.createAuthorizationURL(state, codeVerifier, [
    "openid", "email", "profile", "user.read"
  ])
  
  // Store verifier in KV
  await c.env.KV.put(`oauth:verifier:${state}`, codeVerifier, { expirationTtl: 300 })
  
  // Store return URL
  if (returnTo) {
    await c.env.KV.put(`oauth:return:${state}`, returnTo, { expirationTtl: 300 })
  }
  
  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 300
  })
  
  return c.redirect(url.toString())
}

export async function handleMicrosoftCallback(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
): Promise<Response> {
  const code = c.req.query("code")
  const state = c.req.query("state")
  const savedState = getCookie(c, "oauth_state")
  
  if (!code || !state || state !== savedState) {
    const frontendUrl = getFrontendUrl(c.env);
    return c.redirect(`${frontendUrl}/sign-in?error=invalid_state`)
  }

  const codeVerifier = await c.env.KV.get(`oauth:verifier:${state}`)
  if (!codeVerifier) {
    const frontendUrl = getFrontendUrl(c.env);
    return c.redirect(`${frontendUrl}/sign-in?error=code_expired`)
  }
  
  const returnTo = await c.env.KV.get(`oauth:return:${state}`) || "/"
  
  try {
    // Exchange code for tokens
    const microsoft = new MicrosoftEntraId(
      c.env.AUTH_MICROSOFT_TENANT || "organizations",
      c.env.AUTH_MICROSOFT_CLIENT_ID,
      c.env.AUTH_MICROSOFT_CLIENT_SECRET,
      c.env.AUTH_MICROSOFT_REDIRECT_URL
    )
    const tokens = await microsoft.validateAuthorizationCode(code, codeVerifier)
    
    // Get user from Microsoft
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` }
    })
    const msUser = await response.json() as {
    id: string
    mail?: string
    userPrincipalName?: string
    email?: string
    displayName?: string
    givenName?: string
    surname?: string
  }
    
    // Extract and normalize email
    const rawEmail = msUser.mail || msUser.userPrincipalName || msUser.email
    if (!rawEmail) {
      const frontendUrl = getFrontendUrl(c.env);
    return c.redirect(`${frontendUrl}/sign-in?error=no_email`)
    }
    
    const email = normalizeEmail(rawEmail)
    
    // Check access
    const db = drizzle(c.env.DB, { schema })
    const access = await checkAccess(db, email)
    
    if (!access.allowed) {
      const frontendUrl = getFrontendUrl(c.env);
    return c.redirect(`${frontendUrl}/sign-in?error=${access.reason}`)
    }
    
    // Create session
    await setUserSession(c, {
      user: {
        id: msUser.id,
        email,
        name: msUser.displayName || `${msUser.givenName || ""} ${msUser.surname || ""}`.trim(),
        roles: access.roles,
        controlledActions: access.controlledActions
      },
      loggedInAt: new Date().toISOString(),
      authMethod: "microsoft"
    })
    
    // Ensure personal workspace exists for the user
    try {
      console.log(`[OAuth] Ensuring personal workspace for: ${email}`)
      const workspaceId = await ensurePersonalWorkspace(c, email)
      console.log(`[OAuth] Personal workspace ensured: ${workspaceId} for: ${email}`)
    } catch (workspaceError) {
      console.error("[OAuth] Failed to ensure personal workspace:", workspaceError)
      // Don't fail the login if workspace creation fails, but log it
    }
    
    // Redirect back to frontend
    const frontendUrl = getFrontendUrl(c.env);
    return c.redirect(`${frontendUrl}${returnTo}`)
    
  } catch (error) {
    console.error("OAuth error:", error)
    const frontendUrl = getFrontendUrl(c.env);
    const errorMessage = error instanceof Error ? error.message : String(error)
    return c.redirect(`${frontendUrl}/sign-in?error=oauth_failed&details=${encodeURIComponent(errorMessage)}`)
  }
}
