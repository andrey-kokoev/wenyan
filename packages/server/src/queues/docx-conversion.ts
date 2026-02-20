import type { ExecutionContext, MessageBatch } from "@cloudflare/workers-types"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import type { Bindings } from "../types/env"
import { documents } from "../database/workspaces/schema"
import { getDocxConversionConfig } from "../utils/app-config"

export async function handleDocxConversionQueue(
  batch: MessageBatch<any>,
  env: Bindings,
  ctx: ExecutionContext,
) {
  const db = drizzle(env.DB)
  for (const message of batch.messages) {
    const { documentId, storageKey, filename } = message.body || {}
    if (!documentId || !storageKey) {
      message.ack()
      continue
    }

    try {
      const existingDoc = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.id, documentId))
        .get()
      if (!existingDoc) {
        message.ack()
        continue
      }

      const config = await getDocxConversionConfig(db)
      if (!config.url) {
        throw new Error("Docx conversion URL is not configured")
      }
      let conversionUrl: URL
      try {
        conversionUrl = new URL(config.url)
      } catch {
        throw new Error("Docx conversion URL is invalid")
      }
      conversionUrl.pathname = conversionUrl.pathname.replace(/\/$/, "") + "/convert-json"

      const object = await env.BLOB.get(storageKey)
      if (!object) {
        throw new Error("Document file not found in storage")
      }

      const buffer = await object.arrayBuffer()
      const form = new FormData()
      const blob = new Blob([buffer])
      form.append("file", blob, filename || `document-${documentId}.docx`)

      const response = await fetch(conversionUrl.toString(), {
        method: "POST",
        headers: config.token ? { Authorization: `Bearer ${config.token}` } : undefined,
        body: form,
      })

      if (!response.ok) {
        throw new Error(`Conversion failed (HTTP ${response.status})`)
      }

      const payload = (await response.json()) as { markdown?: string }
      const markdown = payload?.markdown || ""
      if (!markdown.trim()) {
        throw new Error("Conversion service returned empty content")
      }
      await db
        .update(documents)
        .set({
          content: markdown,
          status: "uploaded",
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(documents.id, documentId))
    } catch (error) {
      await db
        .update(documents)
        .set({
          status: "error",
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(documents.id, documentId))
      console.error("Docx conversion failed:", error)
    } finally {
      message.ack()
    }
  }
}
