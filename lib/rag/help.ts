import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

interface HelpPage {
  url: string;
  title: string;
  text: string;
}

export interface HelpSearchHit {
  url: string;
  title: string;
  snippet: string;
}

let pagesCache: HelpPage[] | null = null;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.mdx?$/.test(entry.name) ? [full] : [];
  });
}

function deriveUrl(relPath: string): string {
  const segments = relPath.replace(/\.mdx?$/, '').split('/');
  if (segments[segments.length - 1] === 'index') segments.pop();
  return ['/docs', ...segments].join('/') || '/docs';
}

function stripMdx(body: string): string {
  return body
    .replace(/^(import|export)\s.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getPages(): HelpPage[] {
  if (pagesCache) return pagesCache;

  const contentDir = path.join(process.cwd(), 'content');
  const files = walk(contentDir);
  const pages: HelpPage[] = [];

  for (const file of files) {
    const relPath = path.relative(contentDir, file).split(path.sep).join('/');
    const { data, content } = matter(fs.readFileSync(file, 'utf8'));
    pages.push({
      url: deriveUrl(relPath),
      title: (data.title as string) ?? relPath,
      text: stripMdx(content),
    });
  }

  pagesCache = pages;
  return pages;
}

export function searchHelpArticles(query: string, limit = 6): HelpSearchHit[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const terms = trimmed.split(/\s+/).filter(Boolean);
  return getPages()
    .map((page) => {
      const hay = `${page.title}\n${page.text}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (hay.includes(term)) score += page.title.toLowerCase().includes(term) ? 4 : 1;
      }
      return { page, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ page }) => ({
      url: page.url,
      title: page.title,
      snippet: page.text.slice(0, 260),
    }));
}
