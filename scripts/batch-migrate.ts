import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { migrateArticle } from './migrate-html-to-mdx';
import type { Article } from './parse-forumbee-export';

/** url → localPath (downloaded) or null (dead/timeout source, drop + flag) */
function loadAssetMap(): Map<string, string | null> | undefined {
  const manifest = 'migration/assets-manifest.csv';
  if (!existsSync(manifest)) return undefined;
  const map = new Map<string, string | null>();
  for (const line of readFileSync(manifest, 'utf-8').split('\n').slice(1)) {
    const cols = line.match(/(".*?"|[^,]*)(,|$)/g)?.map((c) =>
      c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')
    );
    if (!cols || cols.length < 6) continue;
    const [, kind, url, status, , localPath] = cols;
    if (kind !== 'img') continue;
    map.set(url, status === 'downloaded' && localPath ? localPath : null);
  }
  return map;
}

/**
 * Maps Forumbee categories to the new IA (spec §5.2) and batch-converts
 * articles.json into MDX drafts under migration/drafts/.
 *
 * Actions per spec §6.1:
 *   migrate      → convert to MDX draft
 *   skip-legacy  → "(old)" duplicates, content exists in current articles
 *   merge        → Dataforms (old), fold into current dataform articles
 *   archive      → discontinued features (Chat & Spaces)
 *   delete       → podcast stubs, misclassified posts
 */

interface Target {
  dir: string;
  action: 'migrate' | 'skip-legacy' | 'merge' | 'archive' | 'delete';
  contentType?: string;
}

// Longest-prefix match against the category path after "Product Documentation / "
const CATEGORY_MAP: Record<string, Target> = {
  '🔎 Quick references / Kissflow glossary': { dir: 'reference/glossary', action: 'migrate', contentType: 'reference' },
  '🔎 Quick references / Important information': { dir: 'whats-new/important-notices', action: 'migrate', contentType: 'reference' },
  '🔎 Quick references / Frequently asked questions': { dir: 'reference/faq', action: 'migrate', contentType: 'reference' },
  '🔎 Quick references / Discontinued services': { dir: 'whats-new/discontinued-services', action: 'migrate', contentType: 'reference' },
  '🎬 Getting started / Onboarding guide': { dir: 'get-started', action: 'migrate', contentType: 'tutorial' },
  '🎬 Getting started / Mobile guide': { dir: 'use/mobile', action: 'migrate' },
  '🎬 Getting started / Developer guide': { dir: 'develop/overview', action: 'migrate' },
  '🎧 Pulse Podcast': { dir: '', action: 'delete' },
  '💼 Troubleshooting guide / Troubleshooting tips and tricks': { dir: 'reference/troubleshooting', action: 'migrate', contentType: 'troubleshooting' },

  '📒 User guide / Apps / Building apps / Building & Deploying Apps (old)': { dir: '', action: 'skip-legacy' },
  '📒 User guide / Apps / Building apps / Dataforms (old)': { dir: 'build/forms', action: 'merge' },
  '📒 User guide / Apps / Building apps / Components': { dir: 'build/components', action: 'migrate', contentType: 'reference' },
  '📒 User guide / Apps / Building apps / Pages': { dir: 'build/pages', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Dataforms in apps': { dir: 'build/forms', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Processes in apps': { dir: 'build/processes', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Boards in apps': { dir: 'build/boards', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Integrations in apps': { dir: 'build/integrations', action: 'migrate' },
  '📒 User guide / Apps / Building apps / External data object': { dir: 'build/external-data', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Roles and permissions': { dir: 'build/roles-and-permissions', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Connections': { dir: 'build/integrations', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Lists in apps': { dir: 'build/lists', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Analytics in apps': { dir: 'build/analytics', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Variables': { dir: 'build/variables', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Model viewer': { dir: 'build/apps', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Resources': { dir: 'build/apps', action: 'migrate' },
  '📒 User guide / Apps / Building apps / Navigation': { dir: 'build/navigation', action: 'migrate' },
  '📒 User guide / Apps / Introduction to Kissflow Apps': { dir: 'build/apps', action: 'migrate', contentType: 'overview' },
  '📒 User guide / Apps / Deploying apps': { dir: 'build/apps', action: 'migrate' },
  '📒 User guide / Apps / Settings': { dir: 'build/apps', action: 'migrate', contentType: 'reference' },
  '📒 User guide / Apps / App Store': { dir: 'app-store', action: 'migrate' },

  '📒 User guide / Forms & Expressions / Expressions': { dir: 'build/expressions', action: 'migrate', contentType: 'reference' },
  '📒 User guide / Forms & Expressions / Fields / Field types': { dir: 'build/forms/field-types', action: 'migrate', contentType: 'reference' },
  '📒 User guide / Forms & Expressions / Fields / Remote lookup': { dir: 'build/forms/field-types', action: 'migrate', contentType: 'reference' },
  '📒 User guide / Forms & Expressions / Fields / Dropdown fields': { dir: 'build/forms/field-types', action: 'migrate', contentType: 'reference' },
  '📒 User guide / Forms & Expressions / Fields': { dir: 'build/forms', action: 'migrate', contentType: 'reference' },
  '📒 User guide / Forms & Expressions / Forms': { dir: 'build/forms', action: 'migrate' },
  '📒 User guide / Forms & Expressions / Lists': { dir: 'build/lists', action: 'migrate' },

  '📒 User guide / Processes / Administering processes': { dir: 'admin/processes', action: 'migrate' },
  '📒 User guide / Processes / Process workflows': { dir: 'build/processes/workflow-design', action: 'migrate' },
  '📒 User guide / Processes / Process reports': { dir: 'build/processes', action: 'migrate' },
  '📒 User guide / Processes / Permission and actions': { dir: 'build/processes/step-configuration', action: 'migrate' },
  '📒 User guide / Processes / Using processes': { dir: 'use/tasks', action: 'migrate' },
  '📒 User guide / Processes': { dir: 'build/processes', action: 'migrate' },

  '📒 User guide / Boards / Using boards': { dir: 'use/boards', action: 'migrate' },
  '📒 User guide / Boards / Reports in Boards / Board metrics': { dir: 'build/boards', action: 'migrate', contentType: 'reference' },
  '📒 User guide / Boards / Reports in Boards': { dir: 'build/boards', action: 'migrate' },
  '📒 User guide / Boards': { dir: 'build/boards', action: 'migrate' },

  '📒 User guide / Decision tables': { dir: 'build/decision-tables', action: 'migrate' },

  '📒 User guide / Integrations / Connectors': { dir: 'build/integrations/connectors', action: 'migrate', contentType: 'reference' },
  '📒 User guide / Integrations / Use cases': { dir: 'build/integrations/use-cases', action: 'migrate', contentType: 'use-case' },
  '📒 User guide / Integrations / Connector builder': { dir: 'build/integrations/connector-builder', action: 'migrate' },
  '📒 User guide / Integrations': { dir: 'build/integrations', action: 'migrate' },

  '📒 User guide / Datasets / Administering datasets': { dir: 'admin/datasets', action: 'migrate' },
  '📒 User guide / Datasets': { dir: 'build/datasets', action: 'migrate' },

  '📒 User guide / Analytics': { dir: 'build/analytics', action: 'migrate' },

  '📒 User guide / Account management / Account governance': { dir: 'admin/governance', action: 'migrate' },
  '📒 User guide / Account management / Account settings / Admin settings / Data backup': { dir: 'admin/data-backup', action: 'migrate' },
  '📒 User guide / Account management / Account settings / Admin settings / Audit log': { dir: 'admin/audit-log', action: 'migrate' },
  '📒 User guide / Account management / Account settings / Admin settings / Account security': { dir: 'admin/security', action: 'migrate' },
  '📒 User guide / Account management / Account settings / Admin settings': { dir: 'admin/account-settings', action: 'migrate' },
  '📒 User guide / Account management / Account settings / My settings': { dir: 'use/personal-settings', action: 'migrate' },
  '📒 User guide / Account management / User and group management': { dir: 'admin/users', action: 'migrate' },
  '📒 User guide / Account management / User provisioning': { dir: 'admin/provisioning', action: 'migrate' },
  '📒 User guide / Account management / Service accounts': { dir: 'admin/service-accounts', action: 'migrate' },

  '📒 User guide / Portal / Portals': { dir: 'admin/portals', action: 'migrate' },
  '📒 User guide / Chats & Spaces': { dir: '', action: 'archive' },
};

const PERSONA_BY_SECTION: Record<string, string> = {
  use: 'end-user',
  build: 'citizen-developer',
  admin: 'admin',
  develop: 'pro-developer',
  'get-started': 'shared',
  reference: 'shared',
  'whats-new': 'shared',
  'app-store': 'shared',
};

function resolveTarget(category: string): Target {
  const path = category.replace(/^Product Documentation \/ /, '').trim();
  const keys = Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (path.startsWith(key)) return CATEGORY_MAP[key];
  }
  return { dir: 'unmapped', action: 'migrate' };
}

function slugFromUrl(oldUrl: string, title: string): string {
  const seg = oldUrl.split('/').filter(Boolean).pop() ?? '';
  if (seg && !/^[0-9a-z]{7,}$/.test(seg)) return seg;
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function guessContentType(title: string, fallback = 'guide'): string {
  if (/overview|introduction|what is/i.test(title)) return 'overview';
  if (/troubleshoot/i.test(title)) return 'troubleshooting';
  return fallback;
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const articles: Article[] = JSON.parse(
  readFileSync('migration/articles.json', 'utf-8')
);

const assetMap = loadAssetMap();
if (assetMap) console.log(`Asset map loaded: ${assetMap.size} URLs`);
else console.log('No assets-manifest.csv — drafts keep remote asset URLs');

const rows: string[] = [
  'title,oldUrl,category,action,targetPath,contentType,persona',
];
const counts: Record<string, number> = {};
const usedPaths = new Set<string>();
let written = 0;

for (const article of articles) {
  const target = resolveTarget(article.category);
  const section = target.dir.split('/')[0];
  const persona = PERSONA_BY_SECTION[section] ?? 'shared';
  const contentType = target.contentType ?? guessContentType(article.title);
  const slug = slugFromUrl(article.oldUrl, article.title);
  let targetPath = target.action === 'migrate' || target.action === 'merge'
    ? `${target.dir}/${slug}`
    : '';

  // Same slug can land in the same dir (e.g. legacy + current articles) —
  // suffix instead of silently overwriting. Uses a non-numeric suffix
  // (not just "-2", "-3") because fumadocs' search indexer builds synthetic
  // per-heading ids as `${page.url}-${n}` (n from 0) — a bare numeric
  // dedup suffix on one page's url can collide with another page's
  // internal heading-id string.
  if (targetPath) {
    let unique = targetPath;
    for (let i = 2; usedPaths.has(unique); i++) unique = `${targetPath}-alt${i}`;
    targetPath = unique;
    usedPaths.add(targetPath);
  }

  counts[target.action] = (counts[target.action] ?? 0) + 1;
  rows.push(
    [article.title, article.oldUrl, article.category, target.action, targetPath, contentType, persona]
      .map(csvEscape)
      .join(',')
  );

  if (target.action !== 'migrate' && target.action !== 'merge') continue;

  const mdx = migrateArticle({
    html: article.html,
    targetPath,
    meta: {
      title: article.title,
      description: `DRAFT (unverified) — migrated from ${article.oldUrl}`,
      contentType,
      persona,
      section,
      tags: [],
    },
    assetMap,
  });

  const outPath = join('migration/drafts', `${targetPath}.mdx`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, mdx);
  written++;
}

writeFileSync('migration/mapping.csv', rows.join('\n'));
console.log(`Mapping: migration/mapping.csv (${articles.length} rows)`);
console.log(`Drafts written: ${written} → migration/drafts/`);
console.log('Actions:', JSON.stringify(counts, null, 2));
