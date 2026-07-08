import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Parses a Forumbee markdown-table export (one row per article, HTML body
 * inline) into individual article records.
 *
 * Table columns: title | text | postedOn | updatedOn | url | baseUri | category.path
 * Rows span multiple lines because the HTML body contains newlines, but a new
 * row always starts at a line beginning with "| " and the body never does.
 */

export interface Article {
  title: string;
  html: string;
  postedOn: string;
  updatedOn: string;
  oldUrl: string;
  baseUri: string;
  category: string;
}

// Dates may be empty; the /t/... url and https baseUri are the reliable anchors
const TAIL_RE =
  /\|\s*((?:\d{4}-\d{2}-\d{2} [\d:]+)?)\s*\|\s*((?:\d{4}-\d{2}-\d{2} [\d:]+)?)\s*\|\s*(\/t\/[^|]+?)\s*\|\s*(https?:[^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$/;

export function parseExport(raw: string): Article[] {
  const lines = raw.split('\n');
  const articles: Article[] = [];
  let current: string[] | null = null;

  const flush = () => {
    if (!current) return;
    const chunk = current.join('\n');
    current = null;

    const tail = chunk.match(TAIL_RE);
    if (!tail) {
      console.error(`SKIP (no tail match): ${chunk.slice(0, 80)}`);
      return;
    }

    const head = chunk.slice(0, tail.index);
    // "| <title> | <html...>" — title is the first cell, never multi-line
    const headMatch = head.match(/^\|\s*(.*?)\s*\|\s*([\s\S]*)$/);
    if (!headMatch) {
      console.error(`SKIP (no head match): ${chunk.slice(0, 80)}`);
      return;
    }

    articles.push({
      title: headMatch[1],
      html: headMatch[2].trim(),
      postedOn: tail[1],
      updatedOn: tail[2],
      oldUrl: tail[3],
      baseUri: tail[4],
      category: tail[5],
    });
  };

  for (const line of lines) {
    if (line.startsWith('| ')) {
      flush();
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  flush();

  // Drop header and separator rows
  return articles.filter(
    (a) => a.title !== 'title' && !/^-+$/.test(a.title.replace(/\s/g, ''))
  );
}

if (require.main === module) {
  const [exportFile, outDir = 'migration'] = process.argv.slice(2);
  if (!exportFile) {
    console.error(
      'Usage: npx tsx scripts/parse-forumbee-export.ts <export.md> [out-dir]'
    );
    process.exit(1);
  }

  const articles = parseExport(readFileSync(exportFile, 'utf-8'));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'articles.json'),
    JSON.stringify(articles, null, 2)
  );

  const byCategory = new Map<string, number>();
  for (const a of articles) {
    byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + 1);
  }

  console.log(`Parsed ${articles.length} articles → ${outDir}/articles.json`);
  console.log(`${byCategory.size} distinct categories`);
}
