import { Hono } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { isAdmin, isDeveloper } from "@andrey-kokoev/wenyan-shared"
import { themes } from "../../../database/workspaces/schema"
import type { Bindings, Variables } from "../../../types/env"
import { ThemeSchema } from "../../../schemas/theme"

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.get("/:id", async (c) => {
  const auth = c.get("auth")?.user
  if (!auth) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  const themeId = c.req.param("id")
  if (!themeId) {
    return c.json({ error: "Theme id is required" }, 400)
  }

  try {
    const db = drizzle(c.env.DB)
    const row = await db.select().from(themes).where(eq(themes.id, themeId)).get()
    if (!row) {
      return c.json({ error: "Theme not found" }, 404)
    }

    const isElevated = isAdmin(auth.roles) || isDeveloper(auth.roles)
    if (row.visibility === "private" && !isElevated && row.createdBy !== auth.email) {
      return c.json({ error: "Forbidden" }, 403)
    }

    const object = await c.env.BLOB.get(row.r2Key)
    if (!object) {
      return c.json({ error: "Theme JSON not found in storage" }, 404)
    }

    const raw = await object.text()
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(raw)
    } catch {
      return c.json({ error: "Theme JSON is invalid" }, 500)
    }

    const parsedTheme = ThemeSchema.safeParse(parsedJson)
    if (!parsedTheme.success) {
      return c.json({ error: "Theme JSON failed validation" }, 500)
    }

    return c.json(parsedTheme.data)
  } catch (err) {
    console.error("Failed to fetch theme:", err)
    return c.json({ error: "Failed to fetch theme" }, 500)
  }
})

export default app
