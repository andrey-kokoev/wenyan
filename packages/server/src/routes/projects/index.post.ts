// ============================================================================
// POST /api/projects - Create a new project
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { zValidator } from "@hono/zod-validator"
import type { Bindings, Variables } from "../../types/env"
import { documents, issues, projects, projectsRelRules, workspacesRelRules } from "../../database/workspaces/schema"
import { eq, sql } from "drizzle-orm"
import { assertWorkspaceAccess } from "../../utils/workspaces"

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  workspaceId: z.number().int().positive(),
})

export const middleware = zValidator("json", createProjectSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const body = await c.req.json()
    const data = createProjectSchema.parse(body)
    const db = drizzle(c.env.DB)

    // Check access to the workspace
    await assertWorkspaceAccess(c, data.workspaceId)

    const result = await db
      .insert(projects)
      .values({
        name: data.name,
        description: data.description,
        workspaceId: data.workspaceId,
      })
      .returning({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        workspaceId: projects.workspaceId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })

    const projectId = result[0]?.id
    if (projectId) {
      const workspaceRules = await db
        .select({ ruleId: workspacesRelRules.ruleId })
        .from(workspacesRelRules)
        .where(eq(workspacesRelRules.workspaceId, data.workspaceId))

      if (workspaceRules.length > 0) {
        await db.insert(projectsRelRules).values(
          workspaceRules.map((entry) => ({
            projectId,
            ruleId: entry.ruleId,
          })),
        )
      }
    }

    const projectRow = result[0]
    const projectWithCounts = projectRow
      ? {
          ...projectRow,
          documentsCount: 0,
          rulesCount: 0,
          issuesCount: 0,
        }
      : null

    if (projectId) {
      const counted = await db
        .select({
          documentsCount: sql<number>`(select count(*) from ${documents} where ${documents.projectId} = ${projectId})`,
          rulesCount: sql<number>`(select count(*) from ${projectsRelRules} where ${projectsRelRules.projectId} = ${projectId})`,
          issuesCount: sql<number>`(select count(*) from ${issues} where ${issues.projectId} = ${projectId})`,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)

      if (projectWithCounts && counted[0]) {
        projectWithCounts.documentsCount = counted[0].documentsCount
        projectWithCounts.rulesCount = counted[0].rulesCount
        projectWithCounts.issuesCount = counted[0].issuesCount
      }
    }

    return c.json({
      success: true,
      data: projectWithCounts ?? result[0],
    }, 201)
  } catch (error) {
    console.error("Error creating project:", error)
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: "Validation error",
        details: error.issues,
      }, 400)
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create project",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500
    )
  }
}
