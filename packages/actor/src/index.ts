export type ActorRole = 'scribe' | 'reviewer' | 'approver' | 'archivist' | 'admin';

export interface RolePermissions {
  draft: boolean;
  review: boolean;
  authorize: boolean;
}

const matrix: Record<ActorRole, RolePermissions> = {
  scribe: { draft: true, review: false, authorize: false },
  reviewer: { draft: false, review: true, authorize: false },
  approver: { draft: false, review: true, authorize: true },
  archivist: { draft: false, review: false, authorize: false },
  admin: { draft: true, review: true, authorize: true },
};

export function canDraft(role: ActorRole): boolean {
  return matrix[role].draft;
}

export function canReview(role: ActorRole): boolean {
  return matrix[role].review;
}

export function canAuthorize(role: ActorRole): boolean {
  return matrix[role].authorize;
}

export function rolePermissions(role: ActorRole): RolePermissions {
  return matrix[role];
}
