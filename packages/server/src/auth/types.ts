// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/auth/types.ts
// Last synced: 2026-01-31
// ============================================================================

export interface UserSession {
  user: {
    id: string              // Microsoft ID or generated
    email: string
    name: string
    roles: number[]
    controlledActions: string[]
  }
  loggedInAt: string        // ISO timestamp
  authMethod: string        // "microsoft", "password", etc.
}

export interface AuthError {
  code: string
  message: string
}

// Re-export for convenience
export type { Bindings, Variables } from '../types/env'
