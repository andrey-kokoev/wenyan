import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import { success } from "@wenyan/shared"
import { roles } from "../../../auth/schema"

export async function listRoles(c: Context) {
  const db = drizzle(c.env.DB)
  const result = await db.select().from(roles).all()
  return c.json(success(result))
}

// Also export as default for direct handler use
export default listRoles
