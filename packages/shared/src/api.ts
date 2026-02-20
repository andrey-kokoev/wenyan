/**
 * API Response Types
 * Shared between frontend and backend
 */

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ValidationErrorDetail {
  path: (string | number)[]
  message: string
  code: string
}

export interface ApiErrorDetail {
  code: ErrorCode
  message: string
  details?: ValidationErrorDetail[]
}

export interface ApiError {
  ok: false
  error: ApiErrorDetail
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INVALID_ID"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "PROTECTED_ROLE"

/**
 * Helper functions for creating API responses
 */
export function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data }
}

export function apiError(
  code: ErrorCode,
  message: string,
  details?: ValidationErrorDetail[]
): ApiError {
  return {
    ok: false,
    error: { code, message, details }
  }
}

/**
 * Type guards
 */
export function isSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.ok === true
}

export function isError<T>(response: ApiResponse<T>): response is ApiError {
  return response.ok === false
}

// Re-export protection utilities from access-control schema
export {
  PROTECTED_ROLE_IDS,
  isProtectedRole,
} from "./schemas/access-control.js"
