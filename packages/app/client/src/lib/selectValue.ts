import type { AcceptableValue } from "reka-ui"

export const toSelectString = (value: AcceptableValue): string | null => {
  if (typeof value !== "string") return null
  if (!value) return null
  return value
}
