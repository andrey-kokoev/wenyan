import { eq, inArray } from "drizzle-orm"
import type { Context } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { Bindings, Variables } from "../../types/env"
import {
  projectsRelRules,
  projectsRelRuleSets,
  ruleSetRelRules,
  rules,
} from "../../database/workspaces/schema"

export async function getEffectiveRulesForProject(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  projectId: number,
) {
  const db = drizzle(c.env.DB)

  const directRules = await db
    .select({
      id: rules.id,
      name: rules.name,
      description: rules.description,
      createdAt: rules.createdAt,
      updatedAt: rules.updatedAt,
    })
    .from(projectsRelRules)
    .innerJoin(rules, eq(projectsRelRules.ruleId, rules.id))
    .where(eq(projectsRelRules.projectId, projectId))

  const ruleSetIdsRows = await db
    .select({ ruleSetId: projectsRelRuleSets.ruleSetId })
    .from(projectsRelRuleSets)
    .where(eq(projectsRelRuleSets.projectId, projectId))

  const ruleSetIds = ruleSetIdsRows.map((row) => row.ruleSetId)

  let ruleSetRules: typeof directRules = []
  if (ruleSetIds.length > 0) {
    ruleSetRules = await db
      .select({
        id: rules.id,
        name: rules.name,
        description: rules.description,
        createdAt: rules.createdAt,
        updatedAt: rules.updatedAt,
      })
      .from(ruleSetRelRules)
      .innerJoin(rules, eq(ruleSetRelRules.ruleId, rules.id))
      .where(inArray(ruleSetRelRules.ruleSetId, ruleSetIds))
  }

  const byId = new Map<number, (typeof directRules)[number]>()
  for (const rule of directRules) byId.set(rule.id, rule)
  for (const rule of ruleSetRules) byId.set(rule.id, rule)

  return Array.from(byId.values())
}
