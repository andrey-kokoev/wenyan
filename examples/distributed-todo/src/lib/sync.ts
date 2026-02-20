export function resolveOfflineConflict<T extends { updatedAt: string }>(left: T, right: T): { winner: T; superseded: T } {
  return new Date(left.updatedAt).getTime() >= new Date(right.updatedAt).getTime()
    ? { winner: left, superseded: right }
    : { winner: right, superseded: left }
}
