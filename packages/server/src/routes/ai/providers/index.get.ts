import { Hono } from "hono"
import type { Bindings, Variables } from "../../../types/env"
import { drizzle } from "drizzle-orm/d1"
import { aiProviders, aiResponders } from "../../../database/workspaces/schema"
import { AiPurposeSchema } from "@andrey-kokoev/wenyan-shared"
import { eq } from "drizzle-orm"

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.get("/", async (c) => {
  const auth = c.get("auth")
  if (!auth?.user) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  try {
    const db = drizzle(c.env.DB)
    const providers = await db.select().from(aiProviders)
    const responders = await db
      .select()
      .from(aiResponders)

    const requiredPurposes = AiPurposeSchema.options
    const requiredCount = requiredPurposes.length

    const purposesByProvider = new Map<string, Set<string>>()
    for (const responder of responders) {
      const set = purposesByProvider.get(responder.providerKey) || new Set<string>()
      set.add(responder.purpose)
      purposesByProvider.set(responder.providerKey, set)
    }

    const data = providers
      .filter((provider) => {
        const purposes = purposesByProvider.get(provider.key)
        return purposes && purposes.size === requiredCount
      })
      .map((provider) => ({
        key: provider.key,
        name: provider.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return c.json({ data })
  } catch (error) {
    console.error("Error listing AI providers:", error)
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to list AI providers",
      },
      500,
    )
  }
})

export default app
