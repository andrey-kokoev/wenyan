import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { success, apiError, type ValidationErrorDetail } from "@andrey-kokoev/wenyan-shared"
import { externalUserIdsRelRoles } from "../../../auth/schema"

const bodySchema = z.object({
  externalUserId: z.string().min(1), // email
  roleId: z.number(),
})

function mapZodErrors(err: z.ZodError): ValidationErrorDetail[] {
  return err.issues.map((e) => ({
    path: e.path.map((segment) => (typeof segment === "symbol" ? segment.toString() : segment)),
    message: e.message,
    code: e.code,
  }))
}

export async function createExternalUserIdRelRole(c: Context) {
  const db = drizzle(c.env.DB)
  const body = await c.req.json()

  let externalUserId: string
  let roleId: number

  try {
    ;({ externalUserId, roleId } = bodySchema.parse(body))
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
    .insert(externalUserIdsRelRoles)
    .values({ externalUserId, roleId })
    .returning()
  
  return c.json(success(mapping), 201)
}

export default createExternalUserIdRelRole
