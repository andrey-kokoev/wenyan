// ============================================================================
// CONTROLLED-ACTIONS TEMPLATE v1.0.0
// Source: harmonia/packages/server/src/auth/email.ts
// Last synced: 2026-01-31
// ============================================================================

/**
 * Email normalization for Azure AD B2B guest users
 * Example: Sydney.Krelitz_corepoweryoga.com#EXT#@globalmaximallc.onmicrosoft.com
 *       → sydney.krelitz@corepoweryoga.com
 */
export function normalizeEmail(email: string): string {
  let result = email.trim().toLowerCase()
  
  // Handle guest users (external Azure AD)
  if (result.endsWith("#ext#@globalmaximallc.onmicrosoft.com")) {
    result = result.replace("#ext#@globalmaximallc.onmicrosoft.com", "")
    if (result.endsWith("_corepoweryoga.com")) {
      result = result.replace("_corepoweryoga.com", "@corepoweryoga.com")
    }
  }
  
  return result
}
