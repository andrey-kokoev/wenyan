import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { success, apiError, type ValidationErrorDetail } from "@andrey-kokoev/wenyan-shared"
import { controlledActions } from "../../../auth/schema"

const bodySchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

function mapZodErrors(err: z.ZodError): ValidationErrorDetail[] {
  return err.issues.map((e) => ({
    path: e.path.map((segment) => (typeof segment === "symbol" ? segment.toString() : segment)),
    message: e.message,
    code: e.code,
  }))
}

export async function updateControlledAction(c: Context) {
  const db = drizzle(c.env.DB)
  const rawId = c.req.param("id")
  const id = Number.parseInt(rawId, 10)

  if (Number.isNaN(id)) {
    return c.json(apiError("INVALID_ID", "Invalid controlled action id"), 400)
  }

  const body = await c.req.json()

  let updates
  try {
    updates = bodySchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        apiError("VALIDATION_ERROR", "Invalid request body", mapZodErrors(err)),
        400,
      )
    }
    throw err
  }
  
  const [action] = await db
    .update(controlledActions)
    .set(updates)
    .where(eq(controlledActions.id, id))
    .returning()
  
  if (!action) {
    return c.json(apiError("NOT_FOUND", "Controlled action not found"), 404)
  }
  
  return c.json(success(action))
}

export default updateControlledAction
