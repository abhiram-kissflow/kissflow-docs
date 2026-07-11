'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { type ComponentProps, useEffect, useState } from 'react';
import {
  getStoredThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme';

const options = [
  ['light', Sun, 'Light'],
  ['dark', Moon, 'Dark'],
  ['auto', Monitor, 'Auto'],
] as const;

export function ThemeSwitch({ className, ...props }: ComponentProps<'div'>) {
  const [preference, setPreference] = useState<ThemePreference>('auto');

  useEffect(() => {
    try {
      setPreference(getStoredThemePreference(localStorage.getItem(THEME_STORAGE_KEY)));
    } catch {
      setPreference('auto');
    }
  }, []);

  const selectTheme = (nextPreference: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {}

    setPreference(nextPreference);
    window.dispatchEvent(new Event('kissflow-docs-theme-change'));
  };

  return (
    <div
      className={`inline-flex overflow-hidden rounded-full border p-1 ${className ?? ''}`}
      {...props}
    >
      {options.map(([value, Icon, label]) => (
        <button
          aria-label={`${label} theme`}
          aria-pressed={preference === value}
          className={`rounded-full p-1.5 ${preference === value ? 'bg-fd-accent text-fd-accent-foreground' : 'text-fd-muted-foreground'}`}
          key={value}
          onClick={() => selectTheme(value)}
          type="button"
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
