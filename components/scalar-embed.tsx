import Link from 'next/link';
import type { ReactNode } from 'react';

interface ScalarEmbedProps {
  title: string;
  description: string;
  href?: string;
}

/**
 * Links into the /api-reference Scalar route. Operation-level deep-linking
 * (via Scalar's generateOperationSlug) is a deliberate follow-up, not done
 * here — see docs/superpowers/specs/2026-07-09-postman-to-scalar-api-reference-design.md.
 */
export function ScalarEmbed({
  title,
  description,
  href = '/api-reference',
}: ScalarEmbedProps): ReactNode {
  return (
    <Link
      href={href}
      className="block p-4 my-4 rounded-lg border border-fd-border bg-fd-card hover:border-fd-primary/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-fd-primary">{title}</span>
      </div>
      <p className="text-sm text-fd-muted-foreground">{description}</p>
    </Link>
  );
}
