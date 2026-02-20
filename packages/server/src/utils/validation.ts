/**
 * Validation utilities
 *
 * Migration Notes:
 * - parsePositiveIntId() has been removed (2026-02-02)
 *   Use validatePositiveInt(value, "id") instead
 */

/**
 * Validates and parses a positive integer parameter
 * @param value The value to validate
 * @param fieldName The name of the field (for error messages)
 * @returns The parsed integer, or null if invalid
 */
export function validatePositiveInt(value: string | undefined, _fieldName = "id"): number | null {
  if (value === undefined || value === null || value === "") {
    return null
  }

  const num = parseInt(value, 10)
  if (isNaN(num) || num <= 0) {
    return null
  }

  return num
}

/**
 * Validates that a value is a non-empty string
 * @param value The value to validate
 * @returns true if valid, false otherwise
 */
export function validateNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Validates that a value is a valid email address
 * @param value The value to validate
 * @returns true if valid, false otherwise
 */
export function validateEmail(value: unknown): value is string {
  if (typeof value !== "string") return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

/**
 * Validates that a value is one of the allowed enum values
 * @param value The value to validate
 * @param allowedValues Array of allowed values
 * @returns true if valid, false otherwise
 */
export function validateEnum<T extends string>(value: unknown, allowedValues: T[]): value is T {
  return typeof value === "string" && allowedValues.includes(value as T)
}
