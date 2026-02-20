import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { success } from "@wenyan/shared"
import { rolesRelControlledActions } from "../../../auth/schema"

export async function listRolesRelControlledActions(c: Context) {
  const db = drizzle(c.env.DB)
  const result = await db.select().from(rolesRelControlledActions).all()
  return c.json(success(result))
}

export default listRolesRelControlledActions
