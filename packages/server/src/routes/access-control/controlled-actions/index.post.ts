import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { success, apiError, type ValidationErrorDetail } from "@andrey-kokoev/wenyan-shared"
import { controlledActions } from "../../../auth/schema"

const bodySchema = z.object({
  code: z.string().min(1),
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

export async function createControlledAction(c: Context) {
  const db = drizzle(c.env.DB)
  const body = await c.req.json()

  let code: string
  let name: string
  let description: string | undefined

  try {
    ;({ code, name, description } = bodySchema.parse(body))
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
    .insert(controlledActions)
    .values({ code, name, description })
    .returning()
  return c.json(success(action), 201)
}

export default createControlledAction
