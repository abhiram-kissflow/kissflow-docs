'use client';

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
import { useUIStrings, type UIStrings } from '@/lib/ui-strings';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import { i18n } from '@/lib/i18n';

const personaCards: {
  key: keyof UIStrings['persona'];
  href: string;
  icon: typeof User;
  external?: boolean;
}[] = [
  { key: 'end-users', href: '/docs/use', icon: User },
  { key: 'builders', href: '/docs/build', icon: GridFour },
  { key: 'admins', href: '/docs/admin', icon: ShieldCheck },
  { key: 'api-docs', href: '/api-reference', icon: BracketsCurly, external: true },
  {
    key: 'sdk-docs',
    href: 'https://developers.kissflow.com/gettingstarted/',
    icon: Code,
    external: true,
  },
  { key: 'roadmap', href: '/docs/roadmap', icon: MapTrifold },
  { key: 'prerelease', href: '/docs/pre-release-notes', icon: Flask },
  { key: 'announcements', href: '/announcements', icon: Megaphone },
];

export function PersonaNav(): ReactNode {
  const strings = useUIStrings();
  const { locale } = useI18n();
  // Internal links keep the reader in their locale (default locale stays prefix-free).
  const prefix = locale && locale !== i18n.defaultLanguage ? `/${locale}` : '';

  return (
    <div className="flex flex-wrap justify-center gap-2 not-prose">
      {personaCards.map((card) => {
        const Icon = card.icon;
        const { title, description } = strings.persona[card.key];
        const className =
          'group inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/70 px-4 py-2 text-sm font-medium text-fd-foreground backdrop-blur-sm transition-colors hover:border-[#CF2C91]/40 hover:bg-fd-card';
        const content = (
          <>
            <Icon
              size={18}
              weight="duotone"
              className="text-fd-muted-foreground transition-colors group-hover:text-[#CF2C91]"
            />
            {title}
          </>
        );
        return card.external ? (
          <a
            key={card.href}
            href={card.href}
            title={description}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
          >
            {content}
          </a>
        ) : (
          <Link key={card.href} href={`${prefix}${card.href}`} title={description} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
