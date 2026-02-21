import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { eq } from "drizzle-orm"
import { success, apiError } from "@andrey-kokoev/wenyan-shared"
import { rolesRelControlledActions } from "../../../auth/schema"

export async function deleteRoleRelControlledAction(c: Context) {
  const db = drizzle(c.env.DB)
  const idParam = c.req.param("id")
  const id = Number.parseInt(idParam, 10)

  if (Number.isNaN(id)) {
    return c.json(apiError("INVALID_ID", "Invalid id"), 400)
  }

  const [mapping] = await db
    .delete(rolesRelControlledActions)
    .where(eq(rolesRelControlledActions.id, id))
    .returning()
  
  if (!mapping) {
    return c.json(apiError("NOT_FOUND", "Mapping not found"), 404)
  }
  
  return c.json(success({ deleted: true }))
}

export default deleteRoleRelControlledAction
