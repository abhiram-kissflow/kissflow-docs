import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { chunkPage, deriveUrl, stripMdx, type DocChunk, type DocPage } from './lib/agent-index';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const OUT_FILE = path.join(process.cwd(), 'agent-worker', 'assets', 'chunks.json');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.mdx?$/.test(entry.name) ? [full] : [];
  });
}

const pages: DocPage[] = [];
const chunks: DocChunk[] = [];

for (const file of walk(CONTENT_DIR)) {
  const relPath = path.relative(CONTENT_DIR, file).split(path.sep).join('/');
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  const url = deriveUrl(relPath);
  const title = (data.title as string) ?? url;
  const text = stripMdx(content);
  pages.push({ url, title, text });
  chunks.push(...chunkPage({ url, title, body: text }));
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({ pages, chunks }));
console.log(`Wrote ${chunks.length} chunks from ${pages.length} pages to ${OUT_FILE}`);
