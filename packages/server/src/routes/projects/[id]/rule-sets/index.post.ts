// ============================================================================
// POST /api/projects/:id/rule-sets - Link a rule set to a project
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../../../types/env"
import { projects, projectsRelRuleSets, ruleSets } from "../../../../database/workspaces/schema"
import { assertProjectAccess } from "../../../../utils/workspaces"
import { validatePositiveInt } from "../../../../utils/validation"

const linkRuleSetSchema = z.object({
  ruleSetId: z.number().int().positive(),
})

export const middleware = zValidator("json", linkRuleSetSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const projectId = validatePositiveInt(c.req.param("id"))
    if (projectId === null) {
      return c.json({ success: false, error: "Invalid project ID" }, 400)
    }

    const body = await c.req.json()
    const data = linkRuleSetSchema.parse(body)

    await assertProjectAccess(c, projectId)

    const db = drizzle(c.env.DB)
    const projectRow = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get()

    if (!projectRow) {
      return c.json({ success: false, error: "Project not found" }, 404)
    }

    const ruleSetRow = await db
      .select({ id: ruleSets.id })
      .from(ruleSets)
      .where(eq(ruleSets.id, data.ruleSetId))
      .get()

    if (!ruleSetRow) {
      return c.json({ success: false, error: "Rule set not found" }, 404)
    }

    await db.insert(projectsRelRuleSets).values({
      projectId,
      ruleSetId: data.ruleSetId,
    })

    return c.json({ success: true }, 201)
  } catch (error) {
    console.error("Error linking rule set to project:", error)
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: "Validation error", details: error.issues },
        400,
      )
    }
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return c.json({ success: false, error: "Rule set already linked to project" }, 409)
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to link rule set",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
