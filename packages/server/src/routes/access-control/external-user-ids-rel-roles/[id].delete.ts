import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { success, apiError } from "@wenyan/shared"
import { externalUserIdsRelRoles } from "../../../auth/schema"

export async function deleteExternalUserIdRelRole(c: Context) {
  const db = drizzle(c.env.DB)
  const idParam = c.req.param("id")
  const id = parseInt(idParam, 10)

  if (Number.isNaN(id)) {
    return c.json(apiError("INVALID_ID", "Invalid mapping id"), 400)
  }

  const [mapping] = await db
    .delete(externalUserIdsRelRoles)
    .where(eq(externalUserIdsRelRoles.id, id))
    .returning()

  if (!mapping) {
    return c.json(apiError("NOT_FOUND", "Mapping not found"), 404)
  }

  return c.json(success({ deleted: true }))
}

export default deleteExternalUserIdRelRole
