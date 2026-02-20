import { Hono } from "hono"
import type { Bindings, Variables } from "../../../types/env"
import {
  UserSettingsUpdateSchema,
} from "../../../schemas/user.settings.schema"
import {
  loadUserSettings,
  mergeUserSettings,
  saveUserSettings,
  stripAiSecrets,
} from "../../../utils/userSettings"

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.put("/", async (c) => {
  try {
    const auth = c.get("auth")
    
    if (!auth?.user) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const payload = await c.req.json()
    const validationResult = UserSettingsUpdateSchema.safeParse(payload)

    if (!validationResult.success) {
      return c.json({
        error: "Invalid settings update",
        details: validationResult.error.format(),
      }, 400)
    }

    const current = await loadUserSettings(c, { includeSecrets: true })
    const settings = mergeUserSettings(current, validationResult.data)

    // NOTE: Settings (theme, schedule display hours) are UI preferences, not sensitive PII.
    // They don't require encryption at rest. User ID is already the key prefix.
    try {
      await saveUserSettings(c, settings)
    } catch (err) {
      console.error("Failed to persist user settings:", err)
      return c.json({ error: "Failed to save user settings" }, 500)
    }

    return c.json({
      success: true,
      settings: stripAiSecrets(settings),
    })
  } catch (error) {
    console.error("Failed to save user settings:", error)
    return c.json({ error: "Failed to save user settings" }, 500)
  }
})

export default app
