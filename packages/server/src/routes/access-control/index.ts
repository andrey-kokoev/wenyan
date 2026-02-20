import { Hono } from "hono"
import type { Bindings, Variables } from "../../types/env"

// Roles
import { listRoles } from "./roles/index.get"
import { createRole } from "./roles/index.post"
import { updateRole } from "./roles/[id].patch"
import { deleteRole } from "./roles/[id].delete"

// Controlled Actions
import { listControlledActions } from "./controlled-actions/index.get"
import { createControlledAction } from "./controlled-actions/index.post"
import { updateControlledAction } from "./controlled-actions/[id].patch"
import { deleteControlledAction } from "./controlled-actions/[id].delete"

// Roles ↔ Controlled Actions mappings
import { listRolesRelControlledActions } from "./roles-rel-controlled-actions/index.get"
import { createRoleRelControlledAction } from "./roles-rel-controlled-actions/index.post"
import { deleteRoleRelControlledAction } from "./roles-rel-controlled-actions/[id].delete"

// External User IDs ↔ Roles mappings
import { listExternalUserIdsRelRoles } from "./external-user-ids-rel-roles/index.get"
import { createExternalUserIdRelRole } from "./external-user-ids-rel-roles/index.post"
import { deleteExternalUserIdRelRole } from "./external-user-ids-rel-roles/[id].delete"

const accessControlRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Roles
accessControlRoutes.get("/roles", listRoles)
accessControlRoutes.post("/roles", createRole)
accessControlRoutes.patch("/roles/:id", updateRole)
accessControlRoutes.delete("/roles/:id", deleteRole)

// Controlled Actions
accessControlRoutes.get("/controlled-actions", listControlledActions)
accessControlRoutes.post("/controlled-actions", createControlledAction)
accessControlRoutes.patch("/controlled-actions/:id", updateControlledAction)
accessControlRoutes.delete("/controlled-actions/:id", deleteControlledAction)

// Roles ↔ Controlled Actions mappings
accessControlRoutes.get("/roles-rel-controlled-actions", listRolesRelControlledActions)
accessControlRoutes.post("/roles-rel-controlled-actions", createRoleRelControlledAction)
accessControlRoutes.delete("/roles-rel-controlled-actions/:id", deleteRoleRelControlledAction)

// External User IDs ↔ Roles mappings
accessControlRoutes.get("/external-user-ids-rel-roles", listExternalUserIdsRelRoles)
accessControlRoutes.post("/external-user-ids-rel-roles", createExternalUserIdRelRole)
accessControlRoutes.delete("/external-user-ids-rel-roles/:id", deleteExternalUserIdRelRole)

export { accessControlRoutes }
