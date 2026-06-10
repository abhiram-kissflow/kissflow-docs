import Link from 'next/link';
import type { ReactNode } from 'react';

interface PersonaCard {
  title: string;
  description: string;
  href: string;
  icon: string;
}

const personaCards: PersonaCard[] = [
  {
    title: 'End Users',
    description: 'Submit forms, track items, approve tasks, use boards.',
    href: '/docs/use',
    icon: '👤',
  },
  {
    title: 'Workflow & App Builders',
    description: 'Design pages, build workflows, create apps with no-code and AI.',
    href: '/docs/build',
    icon: '🔧',
  },
  {
    title: 'Admins',
    description: 'Manage users, security, SSO, governance, and environments.',
    href: '/docs/admin',
    icon: '🛡️',
  },
  {
    title: 'Developers',
    description: 'Extend Kissflow with REST APIs, SDK, and custom components.',
    href: '/docs/develop',
    icon: '💻',
  },
];

export function PersonaNav(): ReactNode {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {personaCards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group block p-6 rounded-xl border border-fd-border bg-fd-card hover:border-fd-primary/50 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">{card.icon}</div>
          <h3 className="text-lg font-semibold text-fd-foreground group-hover:text-fd-primary transition-colors">
            {card.title}
          </h3>
          <p className="mt-1 text-sm text-fd-muted-foreground">
            {card.description}
          </p>
        </Link>
      ))}
    </div>
  );
}
