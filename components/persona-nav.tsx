import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  User,
  GridFour,
  ShieldCheck,
  Code,
} from '@phosphor-icons/react/dist/ssr';

const personaCards = [
  {
    title: 'End Users',
    description: 'Submit forms, track items, approve tasks, use boards.',
    href: '/docs/use',
    icon: User,
  },
  {
    title: 'Workflow & App Builders',
    description: 'Design pages, build workflows, create apps with no-code and AI.',
    href: '/docs/build',
    icon: GridFour,
  },
  {
    title: 'Admins',
    description: 'Manage users, security, SSO, governance, and environments.',
    href: '/docs/admin',
    icon: ShieldCheck,
  },
  {
    title: 'Developers',
    description: 'Extend Kissflow with REST APIs, SDK, and custom components.',
    href: '/docs/develop',
    icon: Code,
  },
] as const;

export function PersonaNav(): ReactNode {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose">
      {personaCards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.href}
            href={card.href}
            className="group block p-5 rounded-xl border border-fd-border bg-fd-card hover:border-fd-foreground/20 hover:shadow-sm transition-all"
          >
            <Icon
              size={28}
              weight="duotone"
              color="#371f1f"
              className="mb-3 group-hover:opacity-80 transition-opacity"
            />
            <h3 className="text-base font-semibold text-fd-foreground">
              {card.title}
            </h3>
            <p className="mt-1 text-sm text-fd-muted-foreground">
              {card.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
