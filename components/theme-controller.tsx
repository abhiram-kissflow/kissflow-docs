'use client';

import { useEffect } from 'react';
import {
  getNextThemeChange,
  getStoredThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
  type ThemePreference,
} from '@/lib/theme';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

function readPreference(): ThemePreference {
  try {
    return getStoredThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

export function ThemeController() {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      if (timeout) clearTimeout(timeout);

      const preference = readPreference();
      applyTheme(resolveTheme(preference));

      if (preference === 'auto') {
        const delay = Math.max(0, getNextThemeChange().getTime() - Date.now()) + 50;
        timeout = setTimeout(sync, delay);
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) sync();
    };

    sync();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('storage', sync);
    window.addEventListener('kissflow-docs-theme-change', sync);

    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('storage', sync);
      window.removeEventListener('kissflow-docs-theme-change', sync);
    };
  }, []);

  return null;
}
