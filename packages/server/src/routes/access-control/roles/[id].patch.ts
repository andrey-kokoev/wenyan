import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  success,
  apiError,
  isProtectedRole,
  type ValidationErrorDetail,
} from "@andrey-kokoev/wenyan-shared"
import { roles } from "../../../auth/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(256).optional(),
})

function mapZodErrors(err: z.ZodError): ValidationErrorDetail[] {
  return err.issues.map((e) => ({
    path: e.path.map((segment) => (typeof segment === "symbol" ? segment.toString() : segment)),
    message: e.message,
    code: e.code,
  }))
}

export async function updateRole(c: Context) {
  const db = drizzle(c.env.DB)
  const id = parseInt(c.req.param("id"), 10)
  if (Number.isNaN(id)) {
    return c.json(apiError("INVALID_ID", "Invalid role id"), 400)
  }

  // Prevent editing of protected system roles
  if (isProtectedRole(id)) {
    return c.json(
      apiError("PROTECTED_ROLE", "Cannot modify protected system role"),
      403
    )
  }

  const body = await c.req.json()

  let updates
  try {
    updates = bodySchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        apiError("VALIDATION_ERROR", "Invalid request body", mapZodErrors(err)),
        400
      )
    }
    throw err
  }

  // Ensure at least one field is provided
  if (Object.keys(updates).length === 0) {
    return c.json(
      apiError("VALIDATION_ERROR", "At least one field must be provided"),
      400
    )
  }

  const [role] = await db
    .update(roles)
    .set(updates)
    .where(eq(roles.id, id))
    .returning()

  if (!role) {
    return c.json(apiError("NOT_FOUND", "Role not found"), 404)
  }

  return c.json(success(role))
}

export default updateRole
