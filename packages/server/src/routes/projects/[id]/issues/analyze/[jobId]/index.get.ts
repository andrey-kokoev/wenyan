// ============================================================================
// GET /api/projects/:id/issues/analyze/:jobId - Get async analysis job status
// ============================================================================

import type { Context } from "hono"
import type { Bindings, Variables } from "../../../../../../types/env"
import { assertProjectAccess } from "../../../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../../../utils/validation"
import { fetchHttpJobStatus } from "../../../../../../utils/httpJobs"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { httpJobs } from "../../../../../../database/workspaces/schema"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
) {
  try {
    const projectId = validatePositiveInt(c.req.param("id"), "id")
    if (projectId === null) {
      return c.json({ success: false, error: "Invalid project ID" }, 400)
    }
    await assertProjectAccess(c, projectId)

    const jobId = c.req.param("jobId")?.trim()
    if (!jobId) {
      return c.json({ success: false, error: "Invalid job ID" }, 400)
    }

    const db = drizzle(c.env.DB)
    const job = await db
      .select({ id: httpJobs.id, projectId: httpJobs.projectId })
      .from(httpJobs)
      .where(eq(httpJobs.id, jobId))
      .get()
    if (!job || job.projectId !== projectId) {
      return c.json({ success: false, error: "Job not found" }, 404)
    }

    const status = await fetchHttpJobStatus(c, jobId)
    return c.json({ success: true, data: status })
  } catch (error) {
    console.error("Issue analysis status error:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load analysis status",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
