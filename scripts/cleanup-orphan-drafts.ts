import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import matter from 'gray-matter';

/**
 * One-off: removes content/*.mdx files left behind by a renamed dedup
 * target path (old numeric "-2" suffix superseded by "-alt2"). Only
 * touches files still marked DRAFT (unverified) — never a reworked file.
 */

const DRAFT_MARKER = 'DRAFT (unverified)';

const orphans = process.argv.slice(2);
if (orphans.length === 0) {
  console.error('Usage: npx tsx scripts/cleanup-orphan-drafts.ts <targetPath> [...]');
  process.exit(1);
}

for (const targetPath of orphans) {
  const contentPath = join('content', `${targetPath}.mdx`);
  if (!existsSync(contentPath)) {
    console.log(`skip (not found): ${contentPath}`);
    continue;
  }
  const { data } = matter(readFileSync(contentPath, 'utf-8'));
  if (!(data.description ?? '').includes(DRAFT_MARKER)) {
    console.log(`SKIP (not a draft, protected): ${contentPath}`);
    continue;
  }
  unlinkSync(contentPath);

  const segments = targetPath.split('/');
  const fileSlug = segments[segments.length - 1];
  const metaPath = join('content', ...segments.slice(0, -1), 'meta.json');
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    meta.pages = (meta.pages ?? []).filter((p: string) => p !== fileSlug);
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
  }
  console.log(`removed: ${contentPath}`);
}
