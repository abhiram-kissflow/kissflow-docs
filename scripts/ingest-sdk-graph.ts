/**
 * Ingests the Kissflow JavaScript SDK reference (developers.kissflow.com) into
 * the RAG content graph so the answer engine retrieves real SDK methods instead
 * of only linking to the portal. Nodes cite the external portal page.
 *
 * Source pages are scraped with the Firecrawl CLI first (kept out of the repo —
 * the graph is the committed artifact, same as the content-graph build):
 *   firecrawl map https://developers.kissflow.com | grep '^https://developers' \
 *     | sort -u > /tmp/sdk-urls.txt
 *   while read u; do slug=$(echo "$u" | sed 's#https://developers.kissflow.com##;s#^/##;s#/$##;s#/#-#g'); \
 *     firecrawl scrape "$u" --only-main-content --json -o "/tmp/sdk-md/${slug:-home}.json"; done < /tmp/sdk-urls.txt
 *
 * Then: set -a; source .env.local; set +a; npx tsx scripts/ingest-sdk-graph.ts [/tmp/sdk-md]
 * Re-runnable: existing `sdk:` nodes/vectors are dropped before re-adding.
 */
import fs from 'node:fs';
import path from 'node:path';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

const MODEL = 'text-embedding-3-small';
const SRC_DIR = process.argv[2] ?? '/tmp/sdk-md';
const GRAPH_DIR = path.join(process.cwd(), 'lib', 'rag', 'content-graph');

interface Node {
  id: string;
  label: string;
  url: string;
  snippet: string;
  community: number;
}
interface Graph {
  nodes: Node[];
  edges: unknown[];
}
interface Embeddings {
  model: string;
  dim: number;
  vectors: Record<string, number[]>;
}

function cleanMarkdown(md: string): string {
  return md
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('[Skip to content'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function main() {
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.json'));
  if (!files.length) throw new Error(`no scraped .json files in ${SRC_DIR}`);

  const sdkNodes: Node[] = [];
  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const data = JSON.parse(fs.readFileSync(path.join(SRC_DIR, file), 'utf8')) as {
      markdown?: string;
      metadata?: { url?: string; sourceURL?: string; title?: string };
    };
    const md = cleanMarkdown(data.markdown ?? '');
    if (!md) continue;
    const meta = data.metadata ?? {};
    const label = (meta.title ?? slug).replace(/\s*\|\s*Developers\s*$/i, '').trim();
    const url = meta.url ?? meta.sourceURL ?? `https://developers.kissflow.com/${slug.replace(/-/g, '/')}`;
    sdkNodes.push({
      id: `sdk:${slug}`,
      label: `${label} (Kissflow SDK)`,
      url,
      snippet: `Kissflow JavaScript SDK — ${label}\n${md}`.slice(0, 1500),
      community: 0, // set below
    });
  }
  if (!sdkNodes.length) throw new Error('no SDK nodes built');

  const graph = JSON.parse(fs.readFileSync(path.join(GRAPH_DIR, 'graph.json'), 'utf8')) as Graph;
  const emb = JSON.parse(fs.readFileSync(path.join(GRAPH_DIR, 'embeddings.json'), 'utf8')) as Embeddings;

  graph.nodes = graph.nodes.filter((n) => !n.id.startsWith('sdk:'));
  for (const k of Object.keys(emb.vectors)) if (k.startsWith('sdk:')) delete emb.vectors[k];

  const community = Math.max(0, ...graph.nodes.map((n) => n.community)) + 1;
  sdkNodes.forEach((n) => (n.community = community));

  console.log(`built ${sdkNodes.length} SDK nodes, embedding…`);
  const { embeddings } = await embedMany({
    model: openai.embedding(MODEL),
    values: sdkNodes.map((n) => `${n.label}\n${n.snippet}`),
  });
  if (embeddings[0].length !== emb.dim) {
    throw new Error(`embedding dim ${embeddings[0].length} != graph dim ${emb.dim}`);
  }
  sdkNodes.forEach((n, i) => (emb.vectors[n.id] = embeddings[i]));
  graph.nodes.push(...sdkNodes);

  fs.writeFileSync(path.join(GRAPH_DIR, 'graph.json'), JSON.stringify(graph, null, 2) + '\n');
  fs.writeFileSync(path.join(GRAPH_DIR, 'embeddings.json'), JSON.stringify(emb, null, 2) + '\n');
  console.log(
    `wrote graph.json (${graph.nodes.length} nodes) + embeddings.json (${Object.keys(emb.vectors).length} vectors, dim ${emb.dim})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
