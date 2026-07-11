'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Braces, Check, Code2, ChevronsUpDown, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

type DocsTab = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
};

const tabs: DocsTab[] = [
  { title: 'Docs', description: 'Guides, admin settings, and how-to articles', href: '/docs/get-started', icon: BookOpen },
  { title: 'API Reference', description: 'REST API endpoints, requests, and responses', href: '/api-reference', icon: Braces, external: true },
  { title: 'SDK Guide', description: 'Build custom components with the Kissflow JavaScript SDK.', href: 'https://developers.kissflow.com/gettingstarted/', icon: Code2, external: true },
];

export function PersistentDocsTabMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const selected = tabs.find((tab) => !tab.external && pathname.startsWith(tab.href)) ?? tabs[0];
  const SelectedIcon = selected.icon;

  return (
    <div className="rounded-lg border bg-fd-secondary/50 p-1 text-fd-secondary-foreground">
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 rounded-md p-1 text-start transition-colors hover:bg-fd-accent">
        <SelectedIcon className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{selected.title}</span>
          <span className="block text-sm text-fd-muted-foreground">{selected.description}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-fd-muted-foreground" />
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-1 border-t pt-1">
          {tabs.filter((tab) => tab.href !== selected.href).map((tab) => {
            const Icon = tab.icon;
            const active = tab.href === selected.href;
            const className = 'flex items-start gap-2 rounded-md p-1.5 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground';
            const content = <><Icon className="mt-0.5 size-5 shrink-0" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-none">{tab.title}</span><span className="mt-1 block text-[0.8125rem] text-fd-muted-foreground">{tab.description}</span></span>{active ? <Check className="mt-0.5 size-3.5 shrink-0 text-fd-primary" /> : null}</>;

            return tab.external ? <a key={tab.href} href={tab.href} target="_blank" rel="noopener noreferrer" className={className}>{content}</a> : <Link key={tab.href} href={tab.href} className={className}>{content}</Link>;
          })}
        </div>
      ) : null}
    </div>
  );
}
