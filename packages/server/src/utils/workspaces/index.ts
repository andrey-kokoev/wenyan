// ============================================================================
// WORKSPACE UTILITIES EXPORTS
// ============================================================================

export {
  getUserEmail,
  canAccessWorkspace,
  getAccessibleWorkspaceIds,
  assertWorkspaceAccess,
  canAccessProject,
  assertProjectAccess,
  getAccessibleProjectIds,
} from "./workspaceAccess"

export {
  ensurePersonalWorkspace,
  ensurePersonalWorkspaceMiddleware,
} from "./ensurePersonalWorkspace"
