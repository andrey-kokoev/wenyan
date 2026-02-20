// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/auth/index.ts
// Last synced: 2026-01-31
// ============================================================================

// Types
export type { UserSession, AuthError } from "./types"

// Session management
export {
  setUserSession,
  getUserSession,
  clearUserSession,
  requireUserSession
} from "./session"

// Email normalization
export { normalizeEmail } from "./email"

// Database queries
export {
  checkAccess,
  getUserRoles,
  getControlledActions,
  hasApprovedDomains
} from "./db"

// Schema
export * from "./schema"

// Routes
export { default as authRoutes } from "./routes"
