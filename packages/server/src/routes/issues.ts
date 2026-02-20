// ============================================================================
// ISSUES API ROUTES
// ============================================================================

import { Hono } from "hono"
import { eq, and, desc } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { issues, issuesRelDocuments, documents, issuesRelRules } from "../database/workspaces/schema"
import type { IssueRow, IssueRowInsert, IssueRelDocumentRowInsert } from "../database/workspaces/schema"
import type { Bindings, Variables } from "../types/env"
import { getUser, requireAuth } from "../middleware/auth"
import { validatePositiveInt } from "../utils/validation"

// Issue with linked documents
interface IssueWithDocuments extends IssueRow {
  documents: Array<{
    id: number
    filename: string
    anchor?: {
      type?: string | null
      start?: number | null
      end?: number | null
      text?: string | null
    }
  }>
  ruleIds?: number[]
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * Apply auth middleware to all routes in this router.
 * All issue endpoints require authentication as they involve sensitive data.
 *
 * Note: If public endpoints are needed in the future, they should be:
 * 1. Defined BEFORE this middleware, or
 * 2. Created in a separate router without this blanket auth requirement
 */
app.use("*", requireAuth())

// ----------------------------------------------------------------------------
// GET /api/issues - List all issues (optionally filtered by project_id)
// ----------------------------------------------------------------------------
app.get("/", async (c) => {
  const db = drizzle(c.env.DB)
  const projectIdParam = c.req.query("project_id")

  try {
    let issueRows: IssueRow[]

    if (projectIdParam) {
      const projectId = validatePositiveInt(projectIdParam, "project_id")
      if (projectId === null) {
        return c.json({ error: { message: "Invalid project_id parameter", code: "INVALID_PARAMETER" } }, 400)
      }
      issueRows = await db
        .select()
        .from(issues)
        .where(eq(issues.projectId, projectId))
        .orderBy(desc(issues.createdAt))
    } else {
      issueRows = await db
        .select()
        .from(issues)
        .orderBy(desc(issues.createdAt))
    }

    // Fetch linked documents for each issue
    const issuesWithDocs: IssueWithDocuments[] = await Promise.all(
      issueRows.map(async (issue) => {
        const docLinks = await db
          .select({
            documentId: issuesRelDocuments.documentId,
            anchorType: issuesRelDocuments.anchorType,
            anchorStart: issuesRelDocuments.anchorStart,
            anchorEnd: issuesRelDocuments.anchorEnd,
            anchorText: issuesRelDocuments.anchorText,
          })
          .from(issuesRelDocuments)
          .where(eq(issuesRelDocuments.issueId, issue.id))

        const documentIds = docLinks.map((l) => l.documentId)

        let linkedDocs: Array<{ id: number; filename: string; anchor?: IssueWithDocuments["documents"][number]["anchor"] }> = []
        if (documentIds.length > 0) {
          const docsRows = await db
            .select({
              id: documents.id,
              filename: documents.filename,
            })
            .from(documents)
            .where(and(...documentIds.map((id) => eq(documents.id, id))))

          const docMap = new Map(docsRows.map((doc) => [doc.id, doc]))
          linkedDocs = docLinks
            .map((link) => {
              const doc = docMap.get(link.documentId)
              if (!doc) return null
              return {
                id: doc.id,
                filename: doc.filename,
                anchor: {
                  type: link.anchorType,
                  start: link.anchorStart,
                  end: link.anchorEnd,
                  text: link.anchorText,
                },
              }
            })
            .filter(Boolean) as Array<{ id: number; filename: string; anchor?: IssueWithDocuments["documents"][number]["anchor"] }>
        }

        const ruleLinks = await db
          .select({ ruleId: issuesRelRules.ruleId })
          .from(issuesRelRules)
          .where(eq(issuesRelRules.issueId, issue.id))

        return {
          ...issue,
          documents: linkedDocs,
          ruleIds: ruleLinks.map((link) => link.ruleId),
        }
      })
    )

    return c.json({ data: issuesWithDocs })
  } catch (error) {
    console.error("[Issues] List error:", error)
    return c.json({ error: { message: "Failed to fetch issues", code: "FETCH_ERROR" } }, 500)
  }
})

// ----------------------------------------------------------------------------
// GET /api/issues/:id - Get a single issue by ID
// ----------------------------------------------------------------------------
app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB)
  const id = validatePositiveInt(c.req.param("id"), "id")

  if (id === null) {
    return c.json({ error: { message: "Invalid issue ID", code: "INVALID_ID" } }, 400)
  }

  try {
    const [issue] = await db
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1)

    if (!issue) {
      return c.json({ error: { message: "Issue not found", code: "NOT_FOUND" } }, 404)
    }

    // Fetch linked documents
    const docLinks = await db
      .select({
        documentId: issuesRelDocuments.documentId,
        anchorType: issuesRelDocuments.anchorType,
        anchorStart: issuesRelDocuments.anchorStart,
        anchorEnd: issuesRelDocuments.anchorEnd,
        anchorText: issuesRelDocuments.anchorText,
      })
      .from(issuesRelDocuments)
      .where(eq(issuesRelDocuments.issueId, issue.id))

    const documentIds = docLinks.map((l) => l.documentId)

    let linkedDocs: Array<{ id: number; filename: string; anchor?: IssueWithDocuments["documents"][number]["anchor"] }> = []
    if (documentIds.length > 0) {
      const docsRows = await db
        .select({
          id: documents.id,
          filename: documents.filename,
        })
        .from(documents)
        .where(and(...documentIds.map((id) => eq(documents.id, id))))

      const docMap = new Map(docsRows.map((doc) => [doc.id, doc]))
      linkedDocs = docLinks
        .map((link) => {
          const doc = docMap.get(link.documentId)
          if (!doc) return null
          return {
            id: doc.id,
            filename: doc.filename,
            anchor: {
              type: link.anchorType,
              start: link.anchorStart,
              end: link.anchorEnd,
              text: link.anchorText,
            },
          }
        })
        .filter(Boolean) as Array<{ id: number; filename: string; anchor?: IssueWithDocuments["documents"][number]["anchor"] }>
    }

    const ruleLinks = await db
      .select({ ruleId: issuesRelRules.ruleId })
      .from(issuesRelRules)
      .where(eq(issuesRelRules.issueId, issue.id))

    const issueWithDocs: IssueWithDocuments = {
      ...issue,
      documents: linkedDocs,
      ruleIds: ruleLinks.map((link) => link.ruleId),
    }

    return c.json({ data: issueWithDocs })
  } catch (error) {
    console.error("[Issues] Get error:", error)
    return c.json({ error: { message: "Failed to fetch issue", code: "FETCH_ERROR" } }, 500)
  }
})

// ----------------------------------------------------------------------------
// POST /api/issues - Create a new issue
// ----------------------------------------------------------------------------
app.post("/", async (c) => {
  const db = drizzle(c.env.DB)

  try {
    const body = await c.req.json<{
      title?: string
      description?: string
      priority?: string
      status?: string
      projectId?: number
      documentIds?: number[]
    }>()

    // Validation
    if (!body.title || body.title.trim() === "") {
      return c.json({ error: { message: "Title is required", code: "VALIDATION_ERROR" } }, 400)
    }

    if (!body.projectId || typeof body.projectId !== "number" || body.projectId <= 0) {
      return c.json({ error: { message: "Valid projectId is required", code: "VALIDATION_ERROR" } }, 400)
    }

    // Validate priority
    const validPriorities = ["low", "medium", "high", "critical"]
    const priority = body.priority || "medium"
    if (!validPriorities.includes(priority)) {
      return c.json({ error: { message: "Invalid priority value", code: "VALIDATION_ERROR" } }, 400)
    }

    // Validate status
    const validStatuses = ["open", "in_progress", "resolved", "closed"]
    const status = body.status || "open"
    if (!validStatuses.includes(status)) {
      return c.json({ error: { message: "Invalid status value", code: "VALIDATION_ERROR" } }, 400)
    }

    // Create issue
    const insertData: IssueRowInsert = {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      priority,
      status,
      origin: "manual",
      projectId: body.projectId,
    }

    const [newIssue] = await db.insert(issues).values(insertData).returning()

    // Link documents if provided
    const documentIds = body.documentIds || []
    if (documentIds.length > 0) {
      const linkData: IssueRelDocumentRowInsert[] = documentIds.map((docId) => ({
        issueId: newIssue.id,
        documentId: docId,
      }))
      await db.insert(issuesRelDocuments).values(linkData)
    }

    // Fetch linked documents for response
    let linkedDocs: Array<{ id: number; filename: string }> = []
    if (documentIds.length > 0) {
      linkedDocs = await db
        .select({
          id: documents.id,
          filename: documents.filename,
        })
        .from(documents)
        .where(and(...documentIds.map((id) => eq(documents.id, id))))
    }

    const issueWithDocs: IssueWithDocuments = {
      ...newIssue,
      documents: linkedDocs,
    }

    return c.json({ data: issueWithDocs }, 201)
  } catch (error) {
    console.error("[Issues] Create error:", error)
    return c.json({ error: { message: "Failed to create issue", code: "CREATE_ERROR" } }, 500)
  }
})

// ----------------------------------------------------------------------------
// PATCH /api/issues/:id - Update an issue
// ----------------------------------------------------------------------------
app.patch("/:id", async (c) => {
  const db = drizzle(c.env.DB)
  const id = validatePositiveInt(c.req.param("id"), "id")

  if (id === null) {
    return c.json({ error: { message: "Invalid issue ID", code: "INVALID_ID" } }, 400)
  }

  try {
    const body = await c.req.json<{
      title?: string
      description?: string | null
      priority?: string
      status?: string
      documentIds?: number[]
      markNonIssue?: boolean
    }>()

    // Check if issue exists
    const [existing] = await db
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1)

    if (!existing) {
      return c.json({ error: { message: "Issue not found", code: "NOT_FOUND" } }, 404)
    }

    // Build update data
    const updateData: Partial<IssueRowInsert> = {}
    if (body.title !== undefined) updateData.title = body.title.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null

    // Validate and update priority
    if (body.priority !== undefined) {
      const validPriorities = ["low", "medium", "high", "critical"]
      if (!validPriorities.includes(body.priority)) {
        return c.json({ error: { message: "Invalid priority value", code: "VALIDATION_ERROR" } }, 400)
      }
      updateData.priority = body.priority
    }

    // Validate and update status
    if (body.status !== undefined) {
      const validStatuses = ["open", "in_progress", "resolved", "closed"]
      if (!validStatuses.includes(body.status)) {
        return c.json({ error: { message: "Invalid status value", code: "VALIDATION_ERROR" } }, 400)
      }
      updateData.status = body.status
    }

    if (body.markNonIssue !== undefined) {
      if (body.markNonIssue) {
        const user = getUser(c)
        updateData.markedAsNonissueBy = user.email
        updateData.markedAsNonissueAt = Math.floor(Date.now() / 1000)
      } else {
        updateData.markedAsNonissueBy = null
        updateData.markedAsNonissueAt = null
      }
    }

    // Update issue
    const [updated] = await db
      .update(issues)
      .set(updateData)
      .where(eq(issues.id, id))
      .returning()

    // Update document links if provided
    if (body.documentIds !== undefined) {
      // Remove existing links
      await db.delete(issuesRelDocuments).where(eq(issuesRelDocuments.issueId, id))

      // Add new links
      if (body.documentIds.length > 0) {
        const linkData: IssueRelDocumentRowInsert[] = body.documentIds.map((docId) => ({
          issueId: id,
          documentId: docId,
        }))
        await db.insert(issuesRelDocuments).values(linkData)
      }
    }

    // Fetch linked documents for response
    const docLinks = await db
      .select({
        documentId: issuesRelDocuments.documentId,
        anchorType: issuesRelDocuments.anchorType,
        anchorStart: issuesRelDocuments.anchorStart,
        anchorEnd: issuesRelDocuments.anchorEnd,
        anchorText: issuesRelDocuments.anchorText,
      })
      .from(issuesRelDocuments)
      .where(eq(issuesRelDocuments.issueId, id))

    const documentIds = docLinks.map((l) => l.documentId)

    let linkedDocs: Array<{ id: number; filename: string; anchor?: IssueWithDocuments["documents"][number]["anchor"] }> = []
    if (documentIds.length > 0) {
      const docsRows = await db
        .select({
          id: documents.id,
          filename: documents.filename,
        })
        .from(documents)
        .where(and(...documentIds.map((id) => eq(documents.id, id))))

      const docMap = new Map(docsRows.map((doc) => [doc.id, doc]))
      linkedDocs = docLinks
        .map((link) => {
          const doc = docMap.get(link.documentId)
          if (!doc) return null
          return {
            id: doc.id,
            filename: doc.filename,
            anchor: {
              type: link.anchorType,
              start: link.anchorStart,
              end: link.anchorEnd,
              text: link.anchorText,
            },
          }
        })
        .filter(Boolean) as Array<{ id: number; filename: string; anchor?: IssueWithDocuments["documents"][number]["anchor"] }>
    }

    const ruleLinks = await db
      .select({ ruleId: issuesRelRules.ruleId })
      .from(issuesRelRules)
      .where(eq(issuesRelRules.issueId, id))

    const issueWithDocs: IssueWithDocuments = {
      ...updated,
      documents: linkedDocs,
      ruleIds: ruleLinks.map((link) => link.ruleId),
    }

    return c.json({ data: issueWithDocs })
  } catch (error) {
    console.error("[Issues] Update error:", error)
    return c.json({ error: { message: "Failed to update issue", code: "UPDATE_ERROR" } }, 500)
  }
})

// ----------------------------------------------------------------------------
// DELETE /api/issues/:id - Delete an issue
// ----------------------------------------------------------------------------
app.delete("/:id", async (c) => {
  const db = drizzle(c.env.DB)
  const id = validatePositiveInt(c.req.param("id"), "id")

  if (id === null) {
    return c.json({ error: { message: "Invalid issue ID", code: "INVALID_ID" } }, 400)
  }

  try {
    // Check if issue exists
    const [existing] = await db
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1)

    if (!existing) {
      return c.json({ error: { message: "Issue not found", code: "NOT_FOUND" } }, 404)
    }

    // Delete issue (cascade will delete document links)
    await db.delete(issues).where(eq(issues.id, id))

    return c.json({ success: true })
  } catch (error) {
    console.error("[Issues] Delete error:", error)
    return c.json({ error: { message: "Failed to delete issue", code: "DELETE_ERROR" } }, 500)
  }
})

export default app
