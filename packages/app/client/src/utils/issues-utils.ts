export type BadgeVariant = "default" | "outline" | "soft" | "subtle" | "ghost"
export type BadgeColor = "primary" | "secondary" | "success" | "warning" | "error" | "info" | "neutral"

export type IssuePriority = "low" | "medium" | "high" | "critical"

const PRIORITY_RANK: Record<IssuePriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function compareIssuesBySeverityTitle<T extends { priority?: string; title?: string }>(a: T, b: T): number {
  const rankA = a.priority && a.priority in PRIORITY_RANK ? PRIORITY_RANK[a.priority as IssuePriority] : 99
  const rankB = b.priority && b.priority in PRIORITY_RANK ? PRIORITY_RANK[b.priority as IssuePriority] : 99
  if (rankA !== rankB) return rankA - rankB
  const titleA = (a.title || "").toLowerCase()
  const titleB = (b.title || "").toLowerCase()
  return titleA.localeCompare(titleB)
}

export function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "analyzed":
    case "resolved":
    case "closed":
      return "default"
    case "processing":
    case "in_progress":
      return "soft"
    case "error":
      return "default"
    default:
      return "outline"
  }
}

export function getStatusColor(status: string): BadgeColor {
  switch (status) {
    case "analyzed":
    case "resolved":
    case "closed":
      return "success"
    case "processing":
    case "in_progress":
      return "secondary"
    case "error":
      return "error"
    default:
      return "neutral"
  }
}

export function getPriorityVariant(priority: string): BadgeVariant {
  switch (priority) {
    case "critical":
      return "default"
    case "high":
      return "soft"
    case "medium":
      return "outline"
    default:
      return "outline"
  }
}

export function getPriorityColor(priority: string): BadgeColor {
  switch (priority) {
    case "critical":
      return "error"
    case "high":
      return "secondary"
    case "medium":
      return "primary"
    default:
      return "neutral"
  }
}
