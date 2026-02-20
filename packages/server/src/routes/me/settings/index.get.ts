import { Hono } from "hono"
import type { Bindings, Variables } from "../../../types/env"
import { loadUserSettings } from "../../../utils/userSettings"

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.get("/", async (c) => {
  const auth = c.get("auth")
  
  if (!auth?.user) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const settings = await loadUserSettings(c, { includeSecrets: false })
    return c.json(settings)
  } catch (e) {
    console.error("Error fetching user settings:", e)
    try {
      const fallback = await loadUserSettings(c, { includeSecrets: false })
      return c.json(fallback)
    } catch {
      return c.json({ error: "Failed to load user settings" }, 500)
    }
  }
})

export default app
