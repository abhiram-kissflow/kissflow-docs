import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { ThemeSwitch } from '@/components/theme-switch';
import { appName } from './shared';

// Plain <img> srcs don't get the Next.js basePath prefix, so add it
// for the GitHub Pages deployment (served under /kissflow-docs).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type BrandVariant = 'default' | 'docs';

export function baseOptions(variant: BrandVariant = 'default'): BaseLayoutProps {
  const compact = variant === 'docs';
  const label = compact ? 'Docs' : 'Documentation';
  const logoClassName = compact ? 'h-4 w-auto' : 'h-4 w-auto';

  return {
    slots: {
      themeSwitch: ThemeSwitch,
    },
    nav: {
      title: (
        <span className="flex items-center gap-2">
          <img
            src={`${basePath}/kissflow-logo.png`}
            alt={appName}
            className={`${logoClassName} dark:hidden`}
          />
          <img
            src={`${basePath}/kissflow-logo-white.png`}
            alt={appName}
            className={`hidden ${logoClassName} dark:block`}
          />
          <span
            className={`relative translate-y-0.5 leading-none text-fd-foreground font-medium ${compact ? 'text-base' : 'text-base'}`}
          >
            {label}
          </span>
        </span>
      ),
      // Logo returns to the answer-first hero from anywhere in the docs.
      url: '/',
    },
  };
}
