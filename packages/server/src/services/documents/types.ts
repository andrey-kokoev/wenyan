import type { Context } from "hono"
import type { Bindings, Variables } from "../../types/env"

export type DocumentContext = Context<{ Bindings: Bindings; Variables: Variables }>
