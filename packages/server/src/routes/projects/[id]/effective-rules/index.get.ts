// ============================================================================
// GET /api/projects/:id/effective-rules - List effective rules for a project
// ============================================================================

import type { Context } from "hono"
import type { Bindings, Variables } from "../../../../types/env"
import { assertProjectAccess } from "../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../utils/validation"
import { getEffectiveRulesForProject } from "../../../../utils/rules/effectiveRules"

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const projectId = validatePositiveInt(c.req.param("id"))
    if (projectId === null) {
      return c.json({ success: false, error: "Invalid project ID" }, 400)
    }

    await assertProjectAccess(c, projectId)

    const rules = await getEffectiveRulesForProject(c, projectId)

    return c.json({ success: true, data: rules })
  } catch (error) {
    console.error("Error listing effective rules:", error)
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list effective rules",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
