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

app.patch("/", async (c) => {
  const auth = c.get("auth")
  
  if (!auth?.user) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const currentSettings = await loadUserSettings(c, { includeSecrets: true })

  const patchPayload = await c.req.json()
  const updateResult = UserSettingsUpdateSchema.safeParse(patchPayload)

  if (!updateResult.success) {
    return c.json({ 
      error: "Invalid settings update", 
      details: updateResult.error.format() 
    }, 400)
  }

  const updatedSettings = mergeUserSettings(currentSettings, updateResult.data)

  await saveUserSettings(c, updatedSettings)

  return c.json({ success: true, settings: stripAiSecrets(updatedSettings) })
})

export default app
