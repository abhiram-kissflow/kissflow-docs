'use client';

import { useState } from 'react';

type Status = 'shipped' | 'planned' | 'in-progress' | 'deferred';

interface RoadmapItem {
  title: string;
  description: string;
  tags: string[];
  status: Status;
}

interface Quarter {
  label: string;
  items: RoadmapItem[];
}

interface YearData {
  year: string;
  quarters: Quarter[];
}

const STATUS_STYLES: Record<Status, { label: string; className: string }> = {
  shipped: {
    label: 'Shipped',
    className:
      'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300',
  },
  planned: {
    label: 'Planned',
    className:
      'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
  'in-progress': {
    label: 'In progress (delayed)',
    className:
      'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
  },
  deferred: {
    label: 'Deferred',
    className:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
};

const TAG_STYLES: Record<string, string> = {
  AI: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  Platform: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  Data: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  Apps: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  UX: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  Process: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  Forms: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Integration: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
};

const ROADMAP: YearData[] = [
  {
    year: '2026',
    quarters: [
      {
        label: 'Q3 2026',
        items: [
          { title: 'Smart attachment - Child table column', description: 'Add and manage attachments directly within each child-table row for better record-level context.', tags: ['Data'], status: 'planned' },
          { title: 'Kissflow MCP', description: 'Connect AI assistants to Kissflow securely so they can retrieve context and take actions across your workflows.', tags: ['Platform'], status: 'planned' },
          { title: 'Redact in form fields', description: 'Hide sensitive field values from selected users while preserving the rest of the record experience.', tags: ['Forms'], status: 'planned' },
          { title: 'Auto-populate public form fields', description: 'Pre-fill public form fields using URL parameters to reduce manual entry and improve completion rates.', tags: ['Forms'], status: 'planned' },
          { title: 'Auto retry', description: 'Automatically retry failed integration jobs based on configurable retry rules.', tags: ['Integration'], status: 'planned' },
          { title: 'Webhook Auth and response', description: 'Secure incoming webhooks with authentication and send customized responses back to the calling system.', tags: ['Integration'], status: 'planned' },
          { title: 'Task delegation - Apps Support', description: 'Delegate app tasks to another user without disrupting approvals, ownership, or workflow progress.', tags: ['Apps'], status: 'planned' },
          { title: 'Connected processes - Details tracking', description: "Track the dependent process's status, progress, and key details directly from the source process.", tags: ['Process'], status: 'planned' },
        ],
      },
      {
        label: 'Q2 2026',
        items: [
          { title: 'Governance - App & Portal (Detailed)', description: 'Provides visibility into workflows, roles, users, and external data across the organization.', tags: ['Apps'], status: 'shipped' },
          { title: 'Smart attachments in mobile', description: 'Intelligent file handling and previews in the mobile app.', tags: ['UX'], status: 'shipped' },
          { title: 'Report scheduling', description: 'Set your own schedule to automatically generate and download reports to your inbox.', tags: ['Data'], status: 'shipped' },
          { title: 'Custom form component', description: 'Design fully customized forms with unique layouts tailored to your data collection needs.', tags: ['Apps'], status: 'in-progress' },
          { title: 'Filter dropdown component', description: 'Build tailored, data-driven lists and views using standard components. Zero coding required.', tags: ['UX'], status: 'in-progress' },
        ],
      },
      {
        label: 'Q1 2026',
        items: [
          { title: 'AI control center', description: 'A centralized hub to manage AI access, monitor usage, and configure security guardrails across all your features.', tags: ['AI', 'Platform'], status: 'shipped' },
          { title: 'Custom component builder', description: 'Build, design, and deploy custom components instantly using plain English. No code required.', tags: ['AI', 'Apps'], status: 'shipped' },
          { title: 'Code gen in Run script', description: 'Generate code instantly within the RunJS connector using AI, transforming logic into scripts in seconds.', tags: ['AI', 'Integration'], status: 'shipped' },
          { title: 'Smart link', description: 'Connect to any external app in seconds. Smart Link automatically detects APIs and configures request details.', tags: ['Integration'], status: 'shipped' },
          { title: 'Process item recovery', description: 'Recover accidentally deleted Process items with ease.', tags: ['Process'], status: 'shipped' },
          { title: 'Smart import', description: 'Skip the manual cleanup. Smart Import auto-maps columns, fixes errors instantly, and remembers your preferences.', tags: ['AI', 'Data'], status: 'deferred' },
        ],
      },
    ],
  },
  {
    year: '2025',
    quarters: [
      {
        label: 'Q4 2025',
        items: [
          { title: 'Document-to-workflow AI', description: 'Convert documents, spreadsheets, and layouts into automated workflows automatically.', tags: ['AI', 'Process'], status: 'shipped' },
          { title: 'Repeater component', description: 'Design fully customizable, data-driven lists and views by using standard page components.', tags: ['UX', 'Apps'], status: 'shipped' },
          { title: 'Dataform child table import', description: 'Bulk import data directly into child table records, improving efficiency.', tags: ['Data'], status: 'shipped' },
          { title: 'Role permissions revamp', description: 'Redesigned the Role-Based Access Control interface for simpler role management.', tags: ['Platform'], status: 'shipped' },
          { title: 'AI contextual search', description: 'Describe workflows in natural language to find relevant solutions.', tags: ['AI', 'Platform'], status: 'shipped' },
          { title: 'Smart advanced filters', description: 'Create complex data views in Processes and Boards using AI.', tags: ['AI', 'Data'], status: 'shipped' },
          { title: 'AI solution overview', description: 'Contextual documentation helps non-technical users understand complex solutions.', tags: ['AI', 'Platform'], status: 'shipped' },
          { title: 'Solution analyzer', description: 'AI-powered analyzer identifies configuration issues with fields, permissions, and process steps.', tags: ['AI', 'Platform'], status: 'shipped' },
          { title: 'AI integration troubleshooting', description: 'Automated diagnosis of failed integrations to identify root causes quickly.', tags: ['AI', 'Integration'], status: 'shipped' },
          { title: 'Customizable homepage', description: 'Personalized dashboard to monitor relevant metrics, requests, and items.', tags: ['UX'], status: 'shipped' },
          { title: 'Files panel', description: 'Centralized attachment review eliminates scattered document navigation.', tags: ['UX'], status: 'shipped' },
          { title: 'Review process changes', description: 'Summarizes form, workflow, and integration updates before publishing.', tags: ['Process'], status: 'shipped' },
          { title: 'Custom SMTP server', description: 'Configure custom SMTP settings for full control over notifications.', tags: ['Platform'], status: 'shipped' },
          { title: 'Password policy config', description: 'Customize password length, complexity, history, and expiration rules.', tags: ['Platform'], status: 'shipped' },
          { title: 'Board item archiving', description: 'Archive old or inactive board tasks to maintain organizational clarity.', tags: ['Apps'], status: 'shipped' },
        ],
      },
      {
        label: 'Q3 2025',
        items: [
          { title: 'OpenAI connector', description: 'Integration brings generative AI capabilities directly into your workflows.', tags: ['Integration'], status: 'shipped' },
          { title: 'Audit log refinements', description: 'Enhanced admin visibility into user actions, timing, and access location.', tags: ['Platform'], status: 'shipped' },
          { title: 'Conditional field requirements', description: 'Mark fields as required based on specific conditions to improve form flexibility.', tags: ['Forms'], status: 'shipped' },
          { title: 'Dataset search', description: 'Search bar for quickly locating specific records in large datasets.', tags: ['Data'], status: 'shipped' },
          { title: 'CSV export limit', description: 'Exports are capped at 100,000 rows per file for improved performance.', tags: ['Data'], status: 'shipped' },
          { title: 'Dataset export enhancements', description: 'Row limitations and scheduling improvements for reliable export functionality.', tags: ['Data'], status: 'shipped' },
        ],
      },
    ],
  },
];

function Card({ item }: { item: RoadmapItem }) {
  const status = STATUS_STYLES[item.status];
  return (
    <div className="rounded-xl border border-fd-border bg-fd-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className={`rounded px-2 py-1 text-[11px] font-bold uppercase leading-none ${TAG_STYLES[tag] ?? 'bg-fd-muted text-fd-muted-foreground'}`}
            >
              {tag}
            </span>
          ))}
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-1 text-[10px] font-bold uppercase leading-none ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <strong className="mb-2 block text-lg font-bold text-fd-foreground">{item.title}</strong>
      <p className="m-0 text-[15px] leading-relaxed text-fd-muted-foreground">{item.description}</p>
    </div>
  );
}

export function RoadmapBoard() {
  const years = ROADMAP.map((y) => y.year);
  const [year, setYear] = useState(years[0]);
  const active = ROADMAP.find((y) => y.year === year) ?? ROADMAP[0];

  return (
    <div className="not-prose">
      <div className="mb-4 inline-flex items-center rounded-full border-[3px] border-green-200 bg-green-50 px-3 py-1 text-[13px] font-semibold tracking-wide text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
        First published on 09 Feb 2026
      </div>

      <p className="mb-2 max-w-3xl text-[15px] leading-relaxed text-fd-muted-foreground">
        This roadmap offers a look at the future of Kissflow. Our goal is to keep you informed so
        you can plan effectively and provide the feedback that shapes our product.
      </p>
      <p className="mb-8 max-w-3xl text-[15px] italic leading-relaxed text-fd-muted-foreground">
        These plans are subject to change and do not represent a commitment to specific features or
        timelines.
      </p>

      <div className="mb-8 flex items-center gap-2" role="tablist" aria-label="Roadmap year">
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

      {active.quarters.map((quarter) => (
        <section key={quarter.label} className="mb-10">
          <p className="mb-5 inline-block border-l-4 border-indigo-500 pl-3 text-base font-semibold uppercase tracking-wide leading-tight text-fd-foreground">
            {quarter.label}
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {quarter.items.map((item) => (
              <Card key={item.title} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
