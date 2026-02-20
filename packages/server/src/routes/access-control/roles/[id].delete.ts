import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { success, apiError, isProtectedRole } from "@wenyan/shared"
import { roles } from "../../../auth/schema"

export async function deleteRole(c: Context) {
  const db = drizzle(c.env.DB)
  const idParam = c.req.param("id")
  const id = parseInt(idParam, 10)

  if (Number.isNaN(id)) {
    return c.json(apiError("INVALID_ID", "Invalid role id"), 400)
  }

  // Prevent deletion of protected system roles
  if (isProtectedRole(id)) {
    return c.json(
      apiError("PROTECTED_ROLE", "Cannot delete protected system role"),
      403
    )
  }

  const [role] = await db
    .delete(roles)
    .where(eq(roles.id, id))
    .returning()

  if (!role) {
    return c.json(apiError("NOT_FOUND", "Role not found"), 404)
  }

  return c.json(success({ deleted: true }))
}

export default deleteRole
