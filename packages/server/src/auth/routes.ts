// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/auth/routes.ts
// Last synced: 2026-01-31
// ============================================================================

import { Hono } from "hono"
import { initiateMicrosoftAuth, handleMicrosoftCallback } from "./microsoft"
import { getUserSession, clearUserSession, setUserSession } from "./session"
import type { Bindings, Variables } from "../types/env"

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /auth/microsoft - Start OAuth flow
app.get("/microsoft", async (c) => {
  const returnTo = c.req.query("returnTo")
  return initiateMicrosoftAuth(c, returnTo || undefined)
})

// GET /auth/callback - OAuth callback
app.get("/callback", async (c) => {
  return handleMicrosoftCallback(c)
})

// GET /auth/dev-login - DEV ONLY: Bypass OAuth for local development
app.get("/dev-login", async (c) => {
  if (c.env.ENVIRONMENT !== "development") {
    return c.json({ error: "Dev login only available in development mode" }, 403)
  }

  const returnTo = c.req.query("returnTo") || "/"

  // Create a mock dev user with all permissions
  await setUserSession(c, {
    user: {
      id: "dev-user-001",
      email: "dev@localhost",
      name: "Development User",
      roles: [1],
      controlledActions: [
        "view_debug_output",
        "manage_access_control",
        "manage_roles",
        "manage_controlled_actions",
        "manage_external_users",
      ],
    },
    loggedInAt: new Date().toISOString(),
    authMethod: "dev",
  })

  // Redirect back to frontend - use Referer to determine frontend URL
  const referer = c.req.header("Referer")
  let redirectUrl: string

  if (referer) {
    // Extract origin from referer (e.g., http://localhost:5175)
    const refererUrl = new URL(referer)
    redirectUrl = `${refererUrl.origin}${returnTo}`
  } else {
    // Fallback to localhost:5175 (configured vite port)
    redirectUrl = `http://localhost:5175${returnTo}`
  }

  return c.redirect(redirectUrl)
})

// POST /auth/logout
app.post("/logout", async (c) => {
  await clearUserSession(c)
  return c.json({ success: true })
})

// GET /session - Get current session
app.get("/session", async (c) => {
  const session = await getUserSession(c)
  return c.json({ user: session?.user || null })
})

export default app
