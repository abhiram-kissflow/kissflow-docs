import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import matter from 'gray-matter';

const DRAFT_MARKER = 'DRAFT (unverified)';

/**
 * Places migrated MDX drafts into content/ and wires meta.json "pages"
 * arrays along the way. Never overwrites an existing content/*.mdx file
 * (manual rework already done for some articles) and never touches an
 * existing meta.json's title/description — only appends missing entries.
 *
 * Reads migration/mapping.csv (action=migrate only; merge/skip-legacy/
 * archive/delete are not auto-placed).
 */

const CONTENT_ROOT = 'content';

function titleize(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length <= 3 && w === w.toLowerCase() && /^[a-z]+$/.test(w) && ['ai', 'ux', 'ui'].includes(w)
      ? w.toUpperCase()
      : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

function loadMigrateTargets(): string[] {
  const lines = readFileSync('migration/mapping.csv', 'utf-8').split('\n');
  const targets: string[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.match(/(".*?"|[^,]*)(,|$)/g)?.map((c) =>
      c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')
    );
    if (!cols || cols.length < 7) continue;
    const [, , , action, targetPath] = cols;
    if (action === 'migrate' && targetPath) targets.push(targetPath);
  }
  return targets;
}

function ensureMetaEntry(dirPath: string, childSlug: string, childTitle: string) {
  const metaPath = join(dirPath, 'meta.json');
  mkdirSync(dirPath, { recursive: true });
  if (!existsSync(metaPath)) {
    writeFileSync(
      metaPath,
      JSON.stringify({ title: childTitle, pages: [childSlug] }, null, 2) + '\n'
    );
    return;
  }
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  meta.pages = (meta.pages ?? []).filter((p: string) => p !== '...');
  if (!meta.pages.includes(childSlug)) meta.pages.push(childSlug);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
}

const targets = loadMigrateTargets();
let placed = 0;
let skippedExisting = 0;
let missingDraft = 0;
const dirsTouched = new Set<string>();

for (const targetPath of targets) {
  const draftPath = join('migration/drafts', `${targetPath}.mdx`);
  const contentPath = join(CONTENT_ROOT, `${targetPath}.mdx`);

  if (existsSync(contentPath)) {
    const { data } = matter(readFileSync(contentPath, 'utf-8'));
    const isUnreworkedDraft = (data.description ?? '').includes(DRAFT_MARKER);
    if (!isUnreworkedDraft) {
      skippedExisting++;
      continue;
    }
    // else: still a draft placed by a prior run — safe to overwrite with a
    // freshly regenerated draft (e.g. after a converter fix).
  }
  if (!existsSync(draftPath)) {
    missingDraft++;
    console.warn(`missing draft: ${draftPath}`);
    continue;
  }

  mkdirSync(dirname(contentPath), { recursive: true });
  copyFileSync(draftPath, contentPath);
  placed++;

  // Wire meta.json at every directory level from content/ down to the
  // file's parent, registering each path segment in its parent's pages[].
  const segments = targetPath.split('/');
  const fileSlug = segments[segments.length - 1];
  let dirAccum = CONTENT_ROOT;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    ensureMetaEntry(dirAccum, seg, titleize(seg));
    dirAccum = join(dirAccum, seg);
    dirsTouched.add(dirAccum);
  }
  ensureMetaEntry(dirAccum, fileSlug, titleize(fileSlug));
}

console.log(`Placed: ${placed}`);
console.log(`Skipped (already exists): ${skippedExisting}`);
console.log(`Missing draft: ${missingDraft}`);
console.log(`Directories wired: ${dirsTouched.size}`);
