import { z } from "zod"

export const ThemeColorsSchema = z.object({
  canvas: z.string().min(1),
  surface: z.string().min(1),
  elevated: z.string().min(1),
  inset: z.string().min(1),
  overlay: z.string().min(1),
  text: z.string().min(1),
  mutedText: z.string().min(1),
  border: z.string().min(1),
  primary: z.string().min(1),
  primaryForeground: z.string().min(1),
  secondary: z.string().min(1),
  secondaryForeground: z.string().min(1),
  success: z.string().min(1),
  warning: z.string().min(1),
  error: z.string().min(1),
  errorForeground: z.string().min(1),
  info: z.string().min(1),
  neutral: z.string().min(1),
  accent: z.string().min(1),
  accentForeground: z.string().min(1),
})

export const ThemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  updatedAt: z.string().min(1).optional(),
  createdBy: z.string().min(1),
  visibility: z.enum(["public", "private"]),
  modes: z.object({
    light: ThemeColorsSchema,
    dark: ThemeColorsSchema,
  }),
})

export const ThemeRegistryEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  r2Key: z.string().min(1),
  isDefault: z.boolean(),
  updatedAt: z.number().int().nonnegative(),
  createdBy: z.string().min(1),
  visibility: z.enum(["public", "private"]),
})

export type ThemeColors = z.infer<typeof ThemeColorsSchema>
export type Theme = z.infer<typeof ThemeSchema>
export type ThemeRegistryEntry = z.infer<typeof ThemeRegistryEntrySchema>
