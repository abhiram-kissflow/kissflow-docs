'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Braces, Check, CircleHelp, Code2, ChevronsUpDown, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DOCS_COACHMARK_SESSION_KEY, shouldShowDocsCoachmark } from '@/lib/docs-coachmark';

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
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    try { setHelpOpen(shouldShowDocsCoachmark(sessionStorage.getItem(DOCS_COACHMARK_SESSION_KEY))); } catch {}
  }, []);
  const dismissHelp = () => {
    try { sessionStorage.setItem(DOCS_COACHMARK_SESSION_KEY, 'dismissed'); } catch {}
    setHelpOpen(false);
  };
  const toggleMenu = () => {
    if (!open) dismissHelp();
    setOpen((value) => !value);
  };
  const selected = tabs.find((tab) => !tab.external && pathname.startsWith(tab.href)) ?? tabs[0];
  const SelectedIcon = selected.icon;

  return (
    <div className="relative rounded-lg border bg-fd-secondary/50 p-1 text-fd-secondary-foreground">
      {helpOpen ? <div className="absolute top-full inset-x-0 z-10 mt-2 rounded-lg border bg-fd-background p-3 text-sm shadow-lg"><p className="font-medium">Looking for developer docs?</p><p className="mt-1 text-fd-muted-foreground">Open this menu to switch to API Reference or SDK Guide.</p><button type="button" onClick={dismissHelp} className="mt-2 text-sm font-medium text-fd-primary hover:underline">Got it</button></div> : null}
      <div className="flex items-center gap-1">
      <button type="button" aria-expanded={open} onClick={toggleMenu} className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-start transition-colors hover:bg-fd-accent">
        <SelectedIcon className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{selected.title}</span>
          <span className="block text-sm text-fd-muted-foreground">{selected.description}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-fd-muted-foreground" />
      </button>
      <button type="button" aria-label="Learn about developer docs" aria-expanded={helpOpen} onClick={() => setHelpOpen((value) => !value)} className="rounded-md p-1 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"><CircleHelp className="size-4" /></button>
      </div>
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
