import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { success, apiError, type ValidationErrorDetail } from "@wenyan/shared"
import { roles } from "../../../auth/schema"

const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

function mapZodErrors(err: z.ZodError): ValidationErrorDetail[] {
  return err.issues.map((e) => ({
    path: e.path.map((segment) => (typeof segment === "symbol" ? segment.toString() : segment)),
    message: e.message,
    code: e.code,
  }))
}

export async function createRole(c: Context) {
  const db = drizzle(c.env.DB)

  try {
    const body = await c.req.json()
    const { name, description } = bodySchema.parse(body)

    const [role] = await db.insert(roles).values({ name, description }).returning()
    return c.json(success(role), 201)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        apiError("VALIDATION_ERROR", "Invalid request body", mapZodErrors(err)),
        400,
      )
    }
    throw err
  }
}

export default createRole
