// Re-export from shared package to maintain single source of truth
export {
  type AiProviderId,
  type AiSettings,
  type AiSettingsUpdate,
  type UserSettingsUpdate,
  ThemeModeValues,
  type ThemeMode,
  UserSettingsSchema,
  UserSettingsUpdateSchema,
  type UserSettings,
  getDefaultUserSettings,
  validateSettingsUpdate,
  createUserSettings,
  getKvPathForUserSettings,
} from "@andrey-kokoev/wenyan-shared"
