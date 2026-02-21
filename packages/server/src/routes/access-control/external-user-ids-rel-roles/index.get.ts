import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { success } from "@andrey-kokoev/wenyan-shared"
import { externalUserIdsRelRoles } from "../../../auth/schema"

export async function listExternalUserIdsRelRoles(c: Context) {
  const db = drizzle(c.env.DB)
  const result = await db.select().from(externalUserIdsRelRoles).all()
  return c.json(success(result))
}

export default listExternalUserIdsRelRoles
