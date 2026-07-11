/**
 * Builds the runtime content graph directly from content/ MDX — no graphify/LLM.
 * Nodes = articles; edges = authored /docs/... cross-links between them.
 * Run with OPENAI_API_KEY set: npx tsx scripts/build-content-graph-direct.ts
 *
 * ponytail: structural graph, not semantic. Node embeddings do relevance;
 * edges are just the links authors wrote. Upgrade to graphify if edge quality
 * ever limits multi-hop answers.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const OUT_DIR = path.join(process.cwd(), 'lib', 'rag', 'content-graph');
const MODEL = 'text-embedding-3-small';

// load key from .env.local (tsx doesn't auto-load it)
if (!process.env.OPENAI_API_KEY && fs.existsSync('.env.local')) {
  const m = fs.readFileSync('.env.local', 'utf8').match(/OPENAI_API_KEY=(.+)/);
  if (m) process.env.OPENAI_API_KEY = m[1].trim();
}
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.mdx?$/.test(e.name) ? [full] : [];
  });
}
function deriveUrl(rel: string): string {
  const seg = rel.replace(/\.mdx?$/, '').split('/');
  if (seg[seg.length - 1] === 'index') seg.pop();
  return ['/docs', ...seg].join('/') || '/docs';
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

interface Node { id: string; label: string; url: string; snippet: string; community: number }

const sections = new Map<string, number>();
const nodes: Node[] = [];
const rawByUrl = new Map<string, string>();

for (const file of walk(CONTENT_DIR)) {
  const rel = path.relative(CONTENT_DIR, file).split(path.sep).join('/');
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  const url = deriveUrl(rel);
  const section = rel.split('/')[0];
  if (!sections.has(section)) sections.set(section, sections.size);
  nodes.push({
    id: url,
    label: (data.title as string) ?? rel,
    url,
    snippet: stripMdx(content).slice(0, 1500),
    community: sections.get(section)!,
  });
  rawByUrl.set(url, content);
}

const nodeUrls = new Set(nodes.map((n) => n.id));
const edgeKeys = new Set<string>();
const edges: { source: string; target: string; relation: string }[] = [];
for (const n of nodes) {
  const raw = rawByUrl.get(n.id)!;
  for (const m of raw.matchAll(/\/docs\/[A-Za-z0-9/_-]+/g)) {
    const target = m[0].replace(/[.,);]+$/, '');
    if (target !== n.id && nodeUrls.has(target)) {
      const key = `${n.id}|${target}`;
      if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push({ source: n.id, target, relation: 'links-to' }); }
    }
  }
}

async function main() {
  console.log(`nodes ${nodes.length}, edges ${edges.length}, embedding...`);
  const { embeddings } = await embedMany({
    model: openai.embedding(MODEL),
    values: nodes.map((n) => `${n.label}\n${n.snippet}`),
  });
  const vectors: Record<string, number[]> = {};
  nodes.forEach((n, i) => { vectors[n.id] = embeddings[i]; });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'graph.json'), JSON.stringify({ nodes, edges }, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT_DIR, 'embeddings.json'), JSON.stringify({ model: MODEL, dim: embeddings[0].length, vectors }, null, 2) + '\n');
  console.log(`wrote graph.json (${nodes.length} nodes, ${edges.length} edges) + embeddings.json (dim ${embeddings[0].length})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
