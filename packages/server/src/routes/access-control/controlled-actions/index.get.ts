import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { success } from "@wenyan/shared"
import { controlledActions } from "../../../auth/schema"

export async function listControlledActions(c: Context) {
  const db = drizzle(c.env.DB)
  const result = await db.select().from(controlledActions).all()
  return c.json(success(result))
}

export default listControlledActions
