import { Hono } from "hono"
import { z } from "zod"
import { drizzle } from "drizzle-orm/d1"
import { asc, eq } from "drizzle-orm"
import type { Bindings, Variables } from "../../../types/env"
import { requirePermission } from "../../../middleware/auth"
import {
  aiProviders,
  aiResponders,
} from "../../../database/workspaces/schema"
import { AiPurposeSchema } from "@wenyan/shared"

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
app.use("*", requirePermission("configure_application"))

const providerSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  defaultBaseUrl: z.string().min(1).optional().nullable(),
})

const providerUpdateSchema = providerSchema.partial()

const responderSchema = z.object({
  purpose: AiPurposeSchema,
  providerKey: z.string().min(1),
  model: z.string().min(1),
  modelType: z.enum(["chat", "prompt", "embedding"]).optional(),
  maxOutputTokens: z.number().int().positive().optional().nullable(),
  settingsJson: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
})

const responderUpdateSchema = responderSchema.partial()

app.get("/responders", async (c) => {
  try {
    const db = drizzle(c.env.DB)
    const responders = await db.select().from(aiResponders).orderBy(
      asc(aiResponders.purpose),
      asc(aiResponders.sortOrder),
      asc(aiResponders.id),
    )

    const data = responders.map((row) => ({
      id: Number(row.id),
      purpose: row.purpose,
      providerKey: row.providerKey,
      model: row.model,
      modelType: row.modelType || "chat",
      maxOutputTokens: row.maxOutputTokens ?? null,
      settingsJson: row.settingsJson ?? null,
      sortOrder: Number(row.sortOrder ?? 0),
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    }))

    return c.json({ data })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.format() }, 400)
    }
    console.error("Admin AI responder list error:", error)
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to list AI responders",
      },
      500,
    )
  }
})

app.post("/responders", async (c) => {
  try {
    const body = responderSchema.parse(await c.req.json())
    const db = drizzle(c.env.DB)
    const [created] = await db
      .insert(aiResponders)
      .values({
        purpose: body.purpose,
        providerKey: body.providerKey,
        model: body.model,
        modelType: body.modelType ?? "chat",
        maxOutputTokens: body.maxOutputTokens ?? null,
        settingsJson: body.settingsJson ?? null,
        sortOrder: body.sortOrder ?? 0,
      })
      .returning()

    return c.json(
      {
        data: {
          id: Number(created.id),
          purpose: created.purpose,
          providerKey: created.providerKey,
          model: created.model,
          modelType: created.modelType || "chat",
          maxOutputTokens: created.maxOutputTokens ?? null,
          settingsJson: created.settingsJson ?? null,
          sortOrder: Number(created.sortOrder ?? 0),
          createdAt: Number(created.createdAt),
          updatedAt: Number(created.updatedAt),
        },
      },
      201,
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.format() }, 400)
    }
    console.error("Admin AI responder create error:", error)
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to create AI responder",
      },
      400,
    )
  }
})

app.patch("/responders/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"))
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid responder ID" }, 400)
    }

    const body = responderUpdateSchema.parse(await c.req.json())
    const db = drizzle(c.env.DB)
    const [updated] = await db
      .update(aiResponders)
      .set({
        purpose: body.purpose,
        providerKey: body.providerKey,
        model: body.model,
        modelType: body.modelType,
        maxOutputTokens: body.maxOutputTokens ?? null,
        settingsJson: body.settingsJson ?? null,
        sortOrder: body.sortOrder,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(aiResponders.id, id))
      .returning()

    return c.json({
      data: {
        id: Number(updated.id),
        purpose: updated.purpose,
        providerKey: updated.providerKey,
        model: updated.model,
        modelType: updated.modelType || "chat",
        maxOutputTokens: updated.maxOutputTokens ?? null,
        settingsJson: updated.settingsJson ?? null,
        sortOrder: Number(updated.sortOrder ?? 0),
        createdAt: Number(updated.createdAt),
        updatedAt: Number(updated.updatedAt),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.format() }, 400)
    }
    console.error("Admin AI responder update error:", error)
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to update AI responder",
      },
      400,
    )
  }
})

app.delete("/responders/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"))
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid responder ID" }, 400)
    }

    const db = drizzle(c.env.DB)
    await db.delete(aiResponders).where(eq(aiResponders.id, id))
    return c.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.format() }, 400)
    }
    console.error("Admin AI responder delete error:", error)
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete AI responder",
      },
      400,
    )
  }
})

app.get("/providers", async (c) => {
  try {
    const db = drizzle(c.env.DB)
    const providers = await db.select().from(aiProviders)
    const data = providers
      .map((provider) => ({
        ...provider,
        defaultBaseUrl: provider.defaultBaseUrl ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return c.json({ data })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.format() }, 400)
    }
    console.error("Admin AI providers list error:", error)
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to list AI providers",
      },
      500,
    )
  }
})

app.post("/providers", async (c) => {
  try {
    const body = providerSchema.parse(await c.req.json())
    const db = drizzle(c.env.DB)
    const [created] = await db
      .insert(aiProviders)
      .values({
        key: body.key,
        name: body.name,
        defaultBaseUrl: body.defaultBaseUrl ?? null,
      })
      .returning()

    return c.json({ data: created }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.format() }, 400)
    }
    console.error("Admin AI provider create error:", error)
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to create AI provider",
      },
      400,
    )
  }
})

app.patch("/providers/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"))
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid provider ID" }, 400)
    }

    const body = providerUpdateSchema.parse(await c.req.json())
    const db = drizzle(c.env.DB)
    const [updated] = await db
      .update(aiProviders)
      .set({
        key: body.key,
        name: body.name,
        defaultBaseUrl: body.defaultBaseUrl ?? null,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(aiProviders.id, id))
      .returning()

    return c.json({ data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.format() }, 400)
    }
    console.error("Admin AI provider update error:", error)
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to update AI provider",
      },
      400,
    )
  }
})

app.delete("/providers/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"))
    if (!Number.isFinite(id)) {
      return c.json({ error: "Invalid provider ID" }, 400)
    }

    const db = drizzle(c.env.DB)
    await db.delete(aiProviders).where(eq(aiProviders.id, id))
    return c.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.format() }, 400)
    }
    console.error("Admin AI provider delete error:", error)
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete AI provider",
      },
      400,
    )
  }
})

export default app
