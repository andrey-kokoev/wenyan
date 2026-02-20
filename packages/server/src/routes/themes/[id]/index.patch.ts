// ============================================================================
// PATCH /api/themes/:id - Update a theme
// ============================================================================

import { z } from "zod"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { ThemeSchema, isAdmin, isDeveloper } from "@wenyan/shared"
import type { Bindings, Variables } from "../../../types/env"
import { themes } from "../../../database/workspaces/schema"

const updateThemeSchema = ThemeSchema

export const middleware = zValidator("json", updateThemeSchema)

export default async function handler(
  c: Context<{ Bindings: Bindings; Variables: Variables }>
) {
  try {
    const auth = c.get("auth")?.user
    if (!auth) {
      return c.json({ success: false, error: "Unauthorized" }, 401)
    }

    const themeId = c.req.param("id")
    if (!themeId) {
      return c.json({ success: false, error: "Theme id is required" }, 400)
    }

    const body = await c.req.json()
    const parsed = updateThemeSchema.parse(body)

    if (parsed.id !== themeId) {
      return c.json({ success: false, error: "Theme ID mismatch" }, 400)
    }

    const db = drizzle(c.env.DB)
    const existing = await db.select().from(themes).where(eq(themes.id, themeId)).get()
    if (!existing) {
      return c.json({ success: false, error: "Theme not found" }, 404)
    }

    const isElevated = isAdmin(auth.roles) || isDeveloper(auth.roles)
    const isOwner = existing.createdBy === auth.email
    if (!isElevated && !isOwner) {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }

    const updatedAtIso = new Date().toISOString().slice(0, 10)
    const r2Key = existing.r2Key
    const themeForStorage = {
      ...parsed,
      updatedAt: updatedAtIso,
      createdBy: existing.createdBy,
    }

    await c.env.BLOB.put(r2Key, JSON.stringify(themeForStorage, null, 2), {
      httpMetadata: { contentType: "application/json" },
    })

    await db
      .update(themes)
      .set({
        name: parsed.name,
        version: parsed.version,
        visibility: parsed.visibility,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(themes.id, themeId))

    return c.json({ success: true })
  } catch (error) {
    console.error("Error updating theme:", error)
    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: "Validation error", details: error.issues },
        400,
      )
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return c.json({ success: false, error: "Forbidden" }, 403)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update theme",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
}
