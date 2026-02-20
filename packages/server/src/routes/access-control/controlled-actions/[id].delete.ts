import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { success, apiError } from "@wenyan/shared"
import { controlledActions } from "../../../auth/schema"

export async function deleteControlledAction(c: Context) {
  const db = drizzle(c.env.DB)
  const id = parseInt(c.req.param("id"), 10)

  if (Number.isNaN(id)) {
    return c.json(apiError("INVALID_ID", "Invalid controlled action id"), 400)
  }
  
  const [action] = await db
    .delete(controlledActions)
    .where(eq(controlledActions.id, id))
    .returning()
  
  if (!action) {
    return c.json(apiError("NOT_FOUND", "Controlled action not found"), 404)
  }
  
  return c.json(success({ deleted: true }))
}

export default deleteControlledAction
