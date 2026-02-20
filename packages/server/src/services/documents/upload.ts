import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { documents } from "../../database/workspaces/schema"
import { getDocUploadConfig, getDocxConversionConfig } from "../../utils/app-config"
import { assertProjectAccess } from "../../utils/workspaces"
import { uploadDocumentSchema } from "./schemas"
import type { DocumentContext } from "./types"

export async function handleDocumentUpload(c: DocumentContext) {
  try {
    const contentType = c.req.header("content-type") || ""
    const requestId = c.get("requestId")

    const db = drizzle(c.env.DB)
    const uploadConfig = await getDocUploadConfig(db)
    if (!uploadConfig.maxMb) {
      return c.json({ success: false, error: "Upload limit is not configured" }, 500)
    }
    const maxUploadBytes = uploadConfig.maxMb * 1024 * 1024

    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData()
      const file = formData.get("file")
      const projectIdRaw = formData.get("projectId")

      if (!projectIdRaw || typeof projectIdRaw !== "string") {
        return c.json({ success: false, error: "projectId is required" }, 400)
      }

      const projectId = Number(projectIdRaw)
      if (!Number.isFinite(projectId) || projectId <= 0) {
        return c.json({ success: false, error: "Invalid projectId" }, 400)
      }

      if (!file || !(file instanceof File)) {
        return c.json({ success: false, error: "file is required" }, 400)
      }

      if (file.size > maxUploadBytes) {
        return c.json({ success: false, error: "File too large" }, 413)
      }

      const filename = file.name
      const lower = filename.toLowerCase()
      const fileType = lower.endsWith(".docx") ? "docx" : lower.endsWith(".md") ? "md" : "txt"

      if (!["txt", "md", "docx"].includes(fileType)) {
        return c.json({ success: false, error: "Unsupported file type" }, 400)
      }

      await assertProjectAccess(c, projectId)

      if (fileType === "docx") {
        const conversionConfig = await getDocxConversionConfig(db)
        if (!conversionConfig.url) {
          return c.json(
            { success: false, error: "Docx conversion is not configured" },
            500,
          )
        }
        try {
          // Validate URL early to avoid storing a file we can't process.
          new URL(conversionConfig.url)
        } catch {
          return c.json(
            { success: false, error: "Docx conversion URL is invalid" },
            500,
          )
        }

        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)
        const storageKey = `projects/${projectId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`
        try {
          const arrayBuffer = await file.arrayBuffer()
          await c.env.BLOB.put(storageKey, arrayBuffer)
        } catch (error) {
          console.error("Failed to store docx file in R2:", error)
          return c.json(
            { success: false, error: "Failed to store document" },
            500,
          )
        }

        const result = await db
          .insert(documents)
          .values({
            projectId,
            filename,
            fileType,
            storageKey,
            status: "processing",
          })
          .returning({
            id: documents.id,
            projectId: documents.projectId,
            filename: documents.filename,
            fileType: documents.fileType,
            status: documents.status,
            createdAt: documents.createdAt,
          })

        const enqueueResponse = await c.env.DOCX_CONVERSION_PRODUCER.fetch("https://internal/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: result[0].id,
            storageKey,
            filename,
            conversionUrl: conversionConfig.url,
            conversionToken: conversionConfig.token || undefined,
          }),
        })

        if (!enqueueResponse.ok) {
          const responseText = await enqueueResponse.text().catch(() => "")
          console.error("Docx conversion enqueue failed:", enqueueResponse.status, responseText)
          await db
            .update(documents)
            .set({ status: "error" })
            .where(eq(documents.id, result[0].id))
          throw new Error(`Failed to enqueue conversion (HTTP ${enqueueResponse.status})`)
        }

        const payload = (await enqueueResponse.json().catch(() => null)) as { ok?: boolean }
        if (!payload?.ok) {
          await db
            .update(documents)
            .set({ status: "error" })
            .where(eq(documents.id, result[0].id))
          throw new Error("Failed to enqueue conversion")
        }

        return c.json({ success: true, data: result[0], requestId }, 201)
      }

      const content = await file.text()
      const result = await db
        .insert(documents)
        .values({
          projectId,
          filename,
          fileType,
          content,
          status: "uploaded",
        })
        .returning({
          id: documents.id,
          projectId: documents.projectId,
          filename: documents.filename,
          fileType: documents.fileType,
          status: documents.status,
          createdAt: documents.createdAt,
        })

      return c.json({ success: true, data: result[0], requestId }, 201)
    }

    const body = await c.req.json()
    const data = uploadDocumentSchema.parse(body)

    if (data.content && data.content.length > maxUploadBytes) {
      return c.json({ success: false, error: "File too large" }, 413)
    }

    await assertProjectAccess(c, data.projectId)

    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)
    const storageKey = `projects/${data.projectId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`

    const result = await db
      .insert(documents)
      .values({
        projectId: data.projectId,
        filename: data.filename,
        fileType: data.fileType,
        content: data.content,
        url: data.url,
        storageKey,
        status: "uploaded",
      })
      .returning({
        id: documents.id,
        projectId: documents.projectId,
        filename: documents.filename,
        fileType: documents.fileType,
        status: documents.status,
        createdAt: documents.createdAt,
      })

    return c.json({
      success: true,
      data: result[0],
      requestId,
    })
  } catch (error) {
    console.error("Error uploading document:", error)
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation error",
          details: error.issues,
        },
        400,
      )
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload document",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
