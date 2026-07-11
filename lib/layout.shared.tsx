import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName } from './shared';

// Plain <img> srcs don't get the Next.js basePath prefix, so add it
// for the GitHub Pages deployment (served under /kissflow-docs).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-baseline gap-2">
          <img
            src={`${basePath}/kissflow-logo.png`}
            alt={appName}
            className="h-5 w-auto dark:hidden"
          />
          <img
            src={`${basePath}/kissflow-logo-white.png`}
            alt={appName}
            className="hidden h-5 w-auto dark:block"
          />
          <span className="text-fd-muted-foreground text-base font-medium">
            Docs
          </span>
        </span>
      ),
      // Logo returns to the answer-first hero from anywhere in the docs.
      url: '/',
    },
  };
}
