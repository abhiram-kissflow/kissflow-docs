import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-baseline gap-2">
          <img
            src="/kissflow-logo.png"
            alt={appName}
            className="h-5 w-auto dark:hidden"
          />
          <img
            src="/kissflow-logo-white.png"
            alt={appName}
            className="hidden h-5 w-auto dark:block"
          />
          <span className="text-fd-muted-foreground text-base font-medium">
            Docs
          </span>
        </span>
      ),
      url: '/docs/get-started',
    },
  };
}
