import type { ApiResponse, ApiError, ValidationErrorDetail } from "@wenyan/shared"

export { type ApiResponse, type ApiError, type ValidationErrorDetail }

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: ValidationErrorDetail[]
  ) {
    super(message)
    this.name = "ApiClientError"
  }
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
  })

  const result: ApiResponse<T> = await response.json()

  if (!result.ok) {
    throw new ApiClientError(
      result.error.code,
      result.error.message,
      result.error.details
    )
  }

  return result.data
}

export interface WenyanSubmitInput {
  id: string
  genre: string
  payload: Record<string, unknown>
  actor: { id: string; role: "scribe" | "reviewer" | "approver" | "archivist" | "admin" }
  submittedAt: string
  metadata?: Record<string, unknown>
}

export async function wenyanSubmit(input: WenyanSubmitInput): Promise<{ id: string }> {
  const response = await fetch("/api/wenyan/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(`Submit failed with ${response.status}`)
  }
  return response.json()
}

export async function wenyanStatus(id: string): Promise<unknown> {
  const response = await fetch(`/api/wenyan/messages/${id}`, {
    credentials: "include",
  })
  if (!response.ok) {
    throw new Error(`Status fetch failed with ${response.status}`)
  }
  return response.json()
}

export async function wenyanStream(): Promise<unknown> {
  const response = await fetch("/api/wenyan/stream", { credentials: "include" })
  if (!response.ok) {
    throw new Error(`Stream fetch failed with ${response.status}`)
  }
  return response.json()
}
