// A centralized registry of unique slugs for all interactive tiles.
// This prevents typos and ensures consistency between tile definitions and the favorites system.

export const SLUGS = {
  ADMIN_USERS: 'admin.users',
  ADMIN_CONTENT: 'admin.content',
  ADMIN_REPORTS: 'admin.reports',
  ADMIN_NOTIFICATIONS: 'admin.notifications',
  ADMIN_SETTINGS: 'admin.settings',
  SETTINGS_THEMES_TEXT: 'settings.themes_text',
  SETTINGS_LOGO: 'settings.logo',
  SETTINGS_INTEGRATIONS: 'settings.integrations',
  SETTINGS_SIGNUP_TOGGLE: 'settings.signup_toggle',
  CONTENT_MODULES: 'content.modules',
  CONTENT_COMPETENCIES: 'content.competencies',
  CONTENT_COURSES: 'content.courses',
  CONTENT_FORMS: 'content.forms',
} as const;

// Create a TypeScript type from the SLUGS object values for type safety.
export type Slug = typeof SLUGS[keyof typeof SLUGS];