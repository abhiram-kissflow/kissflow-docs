'use client';

import { useEffect, useState } from 'react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

interface Note {
  id: string;
  url: string;
  title: string;
  epoch: number | null;
  html: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(epoch: number | null): string {
  if (!epoch) return '';
  const d = new Date(epoch);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

function monthLabel(epoch: number | null): string {
  if (!epoch) return 'Undated';
  const d = new Date(epoch);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function PreReleaseBoard({ years }: { years: string[] }) {
  const [year, setYear] = useState(years[0]);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNotes(null);
    setError(false);
    fetch(`${basePath}/prerelease/${year}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Note[]) => {
        if (!cancelled) setNotes(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const groups: { label: string; notes: Note[] }[] = [];
  for (const note of notes ?? []) {
    const label = monthLabel(note.epoch);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.notes.push(note);
    else groups.push({ label, notes: [note] });
  }

  return (
    <div className="not-prose">
      <p className="mb-2 max-w-3xl text-[15px] leading-relaxed text-fd-muted-foreground">
        Details of features and changes scheduled for upcoming Kissflow releases, published ahead
        of rollout so you can prepare your account, users, and integrations.
      </p>
      <p className="mb-8 max-w-3xl text-[15px] italic leading-relaxed text-fd-muted-foreground">
        Timelines and scope can shift before release. For updates that are already live, see the
        What&apos;s New section.
      </p>

      <div className="mb-8 flex flex-wrap items-center gap-2" role="tablist" aria-label="Pre-release notes year">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            role="tab"
            aria-selected={y === year}
            onClick={() => setYear(y)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              y === year
                ? 'border-[#CF2C91] bg-[#CF2C91] text-white'
                : 'border-fd-border bg-fd-card text-fd-muted-foreground hover:border-[#CF2C91]/40 hover:text-fd-foreground'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-fd-muted-foreground">
          Couldn&apos;t load the notes for {year}. Please refresh and try again.
        </p>
      ) : notes === null ? (
        <p className="text-sm text-fd-muted-foreground">Loading {year} notes…</p>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mb-10">
            <p className="mb-5 inline-block border-l-4 border-indigo-500 pl-3 text-base font-semibold uppercase tracking-wide leading-tight text-fd-foreground">
              {group.label}
            </p>
            <div className="flex flex-col gap-5">
              {group.notes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-xl border border-fd-border bg-fd-card p-6 shadow-sm"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-lg font-bold text-fd-foreground">{note.title}</strong>
                    <span className="shrink-0 rounded border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-bold uppercase leading-none text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
                      {formatDate(note.epoch)}
                    </span>
                  </div>
                  <div
                    className="prerelease-note text-[15px] leading-relaxed text-fd-muted-foreground [&_a]:font-medium [&_a]:text-[#CF2C91] [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-fd-foreground [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:text-fd-foreground [&_img]:my-3 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-fd-border [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_table]:my-3 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:border-fd-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-fd-border [&_th]:bg-fd-muted [&_th]:px-2 [&_th]:py-1 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: note.html }}
                  />
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
