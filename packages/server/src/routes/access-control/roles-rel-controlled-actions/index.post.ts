import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { success, apiError, type ValidationErrorDetail } from "@wenyan/shared"
import { rolesRelControlledActions } from "../../../auth/schema"

const bodySchema = z.object({
  roleId: z.number(),
  controlledActionId: z.number(),
})

function mapZodErrors(err: z.ZodError): ValidationErrorDetail[] {
  return err.issues.map((e) => ({
    path: e.path.map((segment) => (typeof segment === "symbol" ? segment.toString() : segment)),
    message: e.message,
    code: e.code,
  }))
}

export async function createRoleRelControlledAction(c: Context) {
  const db = drizzle(c.env.DB)
  const body = await c.req.json()
  let roleId: number
  let controlledActionId: number

  try {
    ;({ roleId, controlledActionId } = bodySchema.parse(body))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        apiError("VALIDATION_ERROR", "Invalid request body", mapZodErrors(err)),
        400,
      )
    }
    throw err
  }

  const [mapping] = await db
    .insert(rolesRelControlledActions)
    .values({ roleId, controlledActionId })
    .returning()
  return c.json(success(mapping), 201)
}

export default createRoleRelControlledAction
