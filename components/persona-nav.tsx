import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  User,
  GridFour,
  ShieldCheck,
  BracketsCurly,
  Code,
  MapTrifold,
  Flask,
  Megaphone,
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
    title: 'API Docs',
    description: 'REST API reference — endpoints, requests, and responses.',
    href: '/api-reference',
    icon: BracketsCurly,
    external: true,
  },
  {
    title: 'SDK Docs',
    description: 'Build custom components with the Kissflow JavaScript SDK.',
    href: 'https://developers.kissflow.com/gettingstarted/',
    icon: Code,
    external: true,
  },
  {
    title: 'Roadmap',
    description: 'What we are building next across Kissflow.',
    href: '/docs/roadmap',
    icon: MapTrifold,
  },
  {
    title: 'Pre-release Notes',
    description: 'Upcoming features and changes before they ship.',
    href: '/docs/pre-release-notes',
    icon: Flask,
  },
  {
    title: 'Announcements',
    description: 'Latest updates, discontinued services, and important notices.',
    href: '/docs/whats-new',
    icon: Megaphone,
  },
] as const;

export function PersonaNav(): ReactNode {
  return (
    <div className="flex flex-wrap justify-center gap-2 not-prose">
      {personaCards.map((card) => {
        const Icon = card.icon;
        const className =
          'group inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/70 px-4 py-2 text-sm font-medium text-fd-foreground backdrop-blur-sm transition-colors hover:border-[#CF2C91]/40 hover:bg-fd-card';
        const content = (
          <>
            <Icon
              size={18}
              weight="duotone"
              className="text-fd-muted-foreground transition-colors group-hover:text-[#CF2C91]"
            />
            {card.title}
          </>
        );
        return 'external' in card && card.external ? (
          <a
            key={card.href}
            href={card.href}
            title={card.description}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
          >
            {content}
          </a>
        ) : (
          <Link key={card.href} href={card.href} title={card.description} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
