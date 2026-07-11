'use client';

import { useEffect, useRef, useState } from 'react';
import { WingField } from '@/components/wing-field';
import { ArrowUpRight, Plus } from 'lucide-react';

export interface Announcement {
  id: string;
  url: string;
  title: string;
  epoch: number;
  hero: string | null;
  excerpt: string;
  html: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmtDate(epoch: number): string {
  const d = new Date(epoch);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

function monthLabel(epoch: number): string {
  const d = new Date(epoch);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Four Kissflow brand hues, assigned by the announcement's own wording — not
// decoration: the tag tells you what kind of change shipped.
type Kind = { label: string; hex: string };
function kindOf(title: string): Kind {
  const t = title.toLowerCase();
  if (/new in kissflow apps|repeater|page component/.test(t)) return { label: 'Apps', hex: '#1F80FF' };
  if (/now live|live now|just released|newly released|launched|^live\b|export|now support/.test(t))
    return { label: 'Live', hex: '#4AA147' };
  if (/introducing|^new\b|new:|revamped|new integration|builder/.test(t)) return { label: 'New', hex: '#CF2C91' };
  return { label: 'Update', hex: '#F58220' };
}

// Rich-body prose treatment, shared with the pre-release board so community
// HTML (headings, lists, tables, images, links) renders on-brand in both themes.
const PROSE =
  'announcement-body text-[15px] leading-relaxed text-fd-muted-foreground [&_a]:font-medium [&_a]:text-[#CF2C91] [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fd-foreground [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-fd-foreground [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-fd-border [&_li]:mb-1.5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_strong]:text-fd-foreground [&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:border-fd-border [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-fd-border [&_th]:bg-fd-muted [&_th]:px-2.5 [&_th]:py-1.5 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5';

function hideBrokenImage(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none';
}

function Entry({
  item,
  featured,
  open,
  onToggle,
}: {
  item: Announcement;
  featured: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const kind = kindOf(item.title);
  const bodyId = `announcement-${item.id}`;

  return (
    <article
      data-reveal
      className="group relative pl-10 sm:pl-14"
      style={{ ['--kf' as string]: kind.hex }}
    >
      {/* Timeline node on the spine */}
      <span
        aria-hidden
        className="absolute left-[0.5625rem] top-1.5 z-10 h-3 w-3 -translate-x-1/2 rounded-full ring-4 ring-fd-background transition-transform duration-300 group-hover:scale-125 sm:left-[1.0625rem]"
        style={{ backgroundColor: kind.hex, boxShadow: `0 0 0 1px ${kind.hex}55, 0 4px 14px ${kind.hex}44` }}
      />

      <div
        className={`overflow-hidden rounded-2xl border border-fd-border bg-fd-card/80 backdrop-blur-sm transition-colors duration-300 hover:border-[color:var(--kf)]/45 ${
          featured ? 'shadow-[0_1px_0_rgba(0,0,0,0.03)]' : ''
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex w-full items-stretch gap-4 p-5 text-left sm:gap-6 sm:p-6"
        >
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
                style={{ backgroundColor: kind.hex }}
              >
                {kind.label}
              </span>
              <time className="text-[13px] font-medium text-fd-muted-foreground" dateTime={new Date(item.epoch).toISOString()}>
                {fmtDate(item.epoch)}
              </time>
            </div>
            <h3
              className={`font-semibold tracking-tight text-fd-foreground text-balance transition-colors group-hover:text-[color:var(--kf)] ${
                featured ? 'text-xl sm:text-2xl' : 'text-lg'
              }`}
            >
              {item.title}
            </h3>
            {!open && (
              <p className="mt-2 line-clamp-2 max-w-2xl text-[14.5px] leading-relaxed text-fd-muted-foreground">
                {item.excerpt}
              </p>
            )}
            <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--kf)]">
              <Plus
                className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
              />
              {open ? 'Close' : 'Read the full announcement'}
            </span>
          </div>

          {item.hero && (
            <div
              className={`relative hidden shrink-0 overflow-hidden rounded-xl border border-fd-border bg-fd-muted sm:block ${
                featured ? 'w-56 lg:w-72' : 'w-40 lg:w-48'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.hero}
                alt=""
                loading="lazy"
                onError={hideBrokenImage}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </div>
          )}
        </button>

        {/* Expanding full body — grid-rows trick animates height smoothly. */}
        <div
          id={bodyId}
          className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="border-t border-fd-border px-5 pb-6 pt-5 sm:px-6">
              <div className={PROSE} dangerouslySetInnerHTML={{ __html: item.html }} />
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--kf)] hover:underline"
              >
                View on Kissflow Community
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function AnnouncementsFeed({ items }: { items: Announcement[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Reveal-on-scroll that *enhances* an already-visible default: the `js` class
  // is only added on mount, so without JS every entry renders fully visible.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.add('js');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (reduce) {
      nodes.forEach((n) => n.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  // Group entries by month for the dated spine.
  const groups: { label: string; items: Announcement[] }[] = [];
  for (const item of items) {
    const label = monthLabel(item.epoch);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  const first = items[0];
  const last = items[items.length - 1];
  const span = first && last ? `${monthLabel(last.epoch)} — ${monthLabel(first.epoch)}` : '';

  return (
    <div ref={rootRef} className="announcements-root">
      {/* Header band — carries the home hero's atmosphere forward. */}
      <header className="relative isolate overflow-hidden border-b border-fd-border">
        <WingField />
        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-12 pt-14 sm:pb-16 sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-background/70 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-fd-muted-foreground backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#CF2C91]" />
            Product announcements
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-fd-foreground text-balance sm:text-5xl">
            Everything new in Kissflow, as it ships
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fd-muted-foreground sm:text-base">
            Every feature launch, enhancement, and improvement — pulled straight from the Kissflow
            Community and kept up to date. Newest first.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-fd-muted-foreground">
            <span className="font-semibold text-fd-foreground">{items.length} updates</span>
            {span && <span className="hidden sm:inline">·</span>}
            {span && <span>{span}</span>}
          </div>
        </div>
      </header>

      {/* Timeline */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <div className="relative">
          {/* The spine */}
          <span
            aria-hidden
            className="absolute bottom-2 left-[0.5625rem] top-2 w-px -translate-x-1/2 bg-gradient-to-b from-[#CF2C91]/50 via-fd-border to-transparent sm:left-[1.0625rem]"
          />
          {groups.map((group, gi) => (
            <section key={group.label} className="mb-2">
              <div className="sticky top-14 z-20 -mx-4 mb-6 bg-fd-background/85 px-4 py-2 backdrop-blur-sm">
                <h2 className="pl-10 text-sm font-semibold uppercase tracking-[0.14em] text-fd-muted-foreground sm:pl-14">
                  {group.label}
                </h2>
              </div>
              <div className="mb-10 flex flex-col gap-6">
                {group.items.map((item, i) => (
                  <Entry
                    key={item.id}
                    item={item}
                    featured={gi === 0 && i === 0}
                    open={open === item.id}
                    onToggle={() => setOpen((cur) => (cur === item.id ? null : item.id))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-6 border-t border-fd-border pt-8 text-center">
          <p className="text-sm text-fd-muted-foreground">
            Looking for what&apos;s coming next? Explore the{' '}
            <a href="/docs/roadmap" className="font-medium text-[#CF2C91] hover:underline">
              product roadmap
            </a>{' '}
            and{' '}
            <a href="/docs/pre-release-notes" className="font-medium text-[#CF2C91] hover:underline">
              pre-release notes
            </a>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
