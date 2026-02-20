import { ThemeSchema, type Theme } from "@wenyan/shared"
import defaultThemeJson from "@wenyan/shared/themes/default.json"

const parsed = ThemeSchema.safeParse(defaultThemeJson)

export const defaultTheme: Theme | null = parsed.success ? parsed.data : null
