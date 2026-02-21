import { Hono } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { isAdmin, isDeveloper } from "@andrey-kokoev/wenyan-shared"
import { themes } from "../../database/workspaces/schema"
import type { Bindings, Variables } from "../../types/env"
import { ThemeSchema } from "../../schemas/theme"

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.get("/", async (c) => {
  const auth = c.get("auth")?.user
  if (!auth) {
    return c.json({ success: false, error: "Unauthorized" }, 401)
  }
  const isElevated = isAdmin(auth.roles) || isDeveloper(auth.roles)
  const db = drizzle(c.env.DB)
  const rows = await db.select().from(themes)
  return c.json(
    rows
      .filter((row) => {
        if (row.visibility === "public") return true
        if (isElevated) return true
        return row.createdBy === auth.email
      })
      .map((row) => ({
        id: row.id,
        name: row.name,
        version: row.version,
        r2Key: row.r2Key,
        isDefault: !!row.isDefault,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        visibility: row.visibility === "private" ? "private" : "public",
      })),
  )
})

const createThemeSchema = ThemeSchema

app.post("/", zValidator("json", createThemeSchema), async (c) => {
  try {
    const auth = c.get("auth")?.user
    if (!auth) {
      return c.json({ success: false, error: "Unauthorized" }, 401)
    }
    const db = drizzle(c.env.DB)
    const payload = await c.req.json()
    const parsed = createThemeSchema.parse(payload)

    const existing = await db.select().from(themes).where(eq(themes.id, parsed.id)).get()
    if (existing) {
      return c.json({ success: false, error: "Theme ID already exists" }, 409)
    }

    const updatedAt = new Date().toISOString().slice(0, 10)
    const r2Key = `themes/${parsed.id}.json`
    const themeForStorage = {
      ...parsed,
      updatedAt,
      createdBy: auth.email,
      visibility: parsed.visibility,
    }

    await c.env.BLOB.put(r2Key, JSON.stringify(themeForStorage, null, 2), {
      httpMetadata: { contentType: "application/json" },
    })

    await db.insert(themes).values({
      id: parsed.id,
      name: parsed.name,
      version: parsed.version,
      r2Key,
      isDefault: false,
      createdBy: auth.email,
      visibility: parsed.visibility,
      updatedAt: Math.floor(Date.now() / 1000),
    })

    return c.json(
      {
        success: true,
        data: {
          id: parsed.id,
          name: parsed.name,
        version: parsed.version,
        r2Key,
        isDefault: false,
        updatedAt: Math.floor(Date.now() / 1000),
        createdBy: auth.email,
        visibility: parsed.visibility,
      },
    },
      201,
    )
  } catch (error) {
    console.error("Error creating theme:", error)
    if (error instanceof Error && error.message === "Theme ID already exists") {
      return c.json({ success: false, error: "Theme ID already exists" }, 409)
    }
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create theme",
      },
      error instanceof Error && error.message === "Unauthorized" ? 401 : 500,
    )
  }
})

export default app
