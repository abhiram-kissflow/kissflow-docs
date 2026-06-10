import type { ReactNode } from 'react';

interface ScalarEmbedProps {
  title: string;
  description: string;
  href: string;
}

/**
 * Phase 1: Links to existing api.kissflow.com or developers.kissflow.com.
 * Phase 2: Replaced with actual Scalar iframe embed.
 */
export function ScalarEmbed({
  title,
  description,
  href,
}: ScalarEmbedProps): ReactNode {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 my-4 rounded-lg border border-fd-border bg-fd-card hover:border-fd-primary/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-fd-primary">{title}</span>
        <span className="text-xs text-fd-muted-foreground">↗ External</span>
      </div>
      <p className="text-sm text-fd-muted-foreground">{description}</p>
    </a>
  );
}
