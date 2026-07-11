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
    <div className="flex flex-wrap justify-center gap-2 not-prose">
      {personaCards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.href}
            href={card.href}
            title={card.description}
            className="group inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/70 px-4 py-2 text-sm font-medium text-fd-foreground backdrop-blur-sm transition-colors hover:border-[#CF2C91]/40 hover:bg-fd-card"
          >
            <Icon
              size={18}
              weight="duotone"
              className="text-fd-muted-foreground transition-colors group-hover:text-[#CF2C91]"
            />
            {card.title}
          </Link>
        );
      })}
    </div>
  );
}
