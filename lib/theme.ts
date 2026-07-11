export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'auto';

export const THEME_STORAGE_KEY = 'kissflow-docs-theme';

export function getScheduledTheme(date: Date): Theme {
  const hour = date.getHours();
  return hour >= 18 || hour < 6 ? 'dark' : 'light';
}

export function getStoredThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'auto' ? value : 'auto';
}

export function resolveTheme(
  preference: ThemePreference,
  date = new Date()
): Theme {
  return preference === 'auto' ? getScheduledTheme(date) : preference;
}

export function getNextThemeChange(date = new Date()): Date {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);

  if (date.getHours() >= 18) {
    next.setDate(next.getDate() + 1);
    next.setHours(6);
  } else if (date.getHours() >= 6) {
    next.setHours(18);
  } else {
    next.setHours(6);
  }

  return next;
}
