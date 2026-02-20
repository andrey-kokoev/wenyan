import type { Context } from "hono"
import type { Bindings, Variables } from "../types/env"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { httpJobs } from "../database/workspaces/schema"

export type HttpJobRunRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  url: string
  headers?: Record<string, string>
  body?: string
  timeoutSeconds?: number
  responseMaxBytes?: number
}

type HttpJobEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { error?: string; code?: string } }

export type HttpJobStatus = {
  jobId: string
  status: "queued" | "running" | "completed" | "failed"
  httpStatus?: number | null
  responseKey?: string | null
  error?: string | null
  createdAt: number
  updatedAt: number
}

export type HttpJobResult = {
  jobId: string
  httpStatus: number
  headers: Record<string, string>
  body?: string
  truncated?: boolean
}

export async function enqueueHttpJob(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  payload: HttpJobRunRequest,
  meta: { projectId: number; requestedBy: string },
) {
  const response = await c.env.HTTP_JOB_PRODUCER.fetch("https://http-job-producer/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, meta }),
  })
  const data = (await response.json().catch(() => null)) as HttpJobEnvelope<{ jobId: string }> | null
  if (!response.ok || !data || !("ok" in data) || !data.ok) {
    throw new Error(
      data && "ok" in data && !data.ok
        ? data.error?.error || "Failed to enqueue job"
        : `Failed to enqueue job (HTTP ${response.status})`,
    )
  }
  return data.data.jobId
}

export async function fetchHttpJobStatus(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  jobId: string,
) {
  const db = drizzle(c.env.DB)
  const row = await db
    .select()
    .from(httpJobs)
    .where(eq(httpJobs.id, jobId))
    .get()
  if (!row) {
    throw new Error("Job not found")
  }
  return {
    jobId: row.id,
    status: row.status as HttpJobStatus["status"],
    httpStatus: row.responseStatus ?? null,
    responseKey: row.responseKey ?? null,
    error: row.error ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function fetchHttpJobResult(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  jobId: string,
) {
  const db = drizzle(c.env.DB)
  const row = await db
    .select({ responseKey: httpJobs.responseKey })
    .from(httpJobs)
    .where(eq(httpJobs.id, jobId))
    .get()
  if (!row?.responseKey) {
    throw new Error("Result not available")
  }
  const object = await c.env.BLOB.get(row.responseKey)
  if (!object) {
    throw new Error("Result not available")
  }
  const payload = (await object.json().catch(() => null)) as HttpJobResult | null
  if (!payload) {
    throw new Error("Result not available")
  }
  return payload
}
