/**
 * build-content-graph.ts — regenerate the committed runtime graph artifacts.
 *
 * This script is run MANUALLY (not in CI, not at build time) to replace the
 * fixtures at lib/rag/content-graph/graph.json and lib/rag/content-graph/embeddings.json
 * with the real content knowledge graph.
 *
 * Prerequisites:
 *   1. A graphify extraction has already been run over the `content/` corpus,
 *      producing a graph.json in graphify's node-link format
 *      (`{ directed, multigraph, graph, nodes: [...], links: [...] }`).
 *   2. OPENAI_API_KEY is set in the environment (embeddings are computed via the
 *      OpenAI `text-embedding-3-small` model).
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/build-content-graph.ts <path-to-graphify-graph.json>
 *
 * It transforms graphify's raw nodes/links into the runtime GraphNode/edge shape,
 * embeds each node's `label + snippet`, and OVERWRITES the two committed artifacts.
 * Run it from the repo root so `content/` resolves relative to process.cwd().
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

const GRAPH_DIR = path.join(process.cwd(), 'lib', 'rag', 'content-graph');
const CONTENT_DIR = path.join(process.cwd(), 'content');
const MODEL = 'text-embedding-3-small';
const SNIPPET_LEN = 300;

// --- Runtime artifact shapes -------------------------------------------------

interface GraphNode {
  id: string;
  label: string;
  url: string;
  snippet: string;
  community: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

// --- Graphify node-link shapes (partial; only fields we consume) ------------

interface GraphifyNode {
  id: string;
  label?: string;
  source_file?: string;
  file_type?: string;
  community?: number;
  [key: string]: unknown;
}

interface GraphifyLink {
  source: string;
  target: string;
  relation?: string;
  [key: string]: unknown;
}

interface GraphifyGraph {
  nodes: GraphifyNode[];
  links: GraphifyLink[];
}

// --- Copied verbatim from lib/rag/help.ts (kept in sync deliberately; NOT
//     imported, to avoid coupling this build script to help.ts's internals) ---

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

// --- Helpers ----------------------------------------------------------------

/** Strip a leading `content/` segment so paths resolve the same way regardless
 *  of whether graphify's source_file is repo-relative or content-relative. */
function normalizeSourceFile(sourceFile: string): string {
  return sourceFile.replace(/^content\//, '');
}

/** Read an article's stripped text and return the leading snippet. Falls back to
 *  the label (with a warning) if the source file can't be read. */
function buildSnippet(sourceFile: string, label: string): string {
  const rel = normalizeSourceFile(sourceFile);
  const abs = path.join(CONTENT_DIR, rel);
  try {
    const { content } = matter(fs.readFileSync(abs, 'utf8'));
    return stripMdx(content).slice(0, SNIPPET_LEN);
  } catch {
    console.warn(`  warn: could not read ${abs}; using label as snippet fallback`);
    return label.slice(0, SNIPPET_LEN);
  }
}

/** A graphify node maps to a real doc only if it carries a source_file that
 *  points at an .mdx/.md file. Sub-symbol nodes (no source_file) are skipped. */
function isDocNode(node: GraphifyNode): boolean {
  if (!node.source_file) return false;
  return /\.mdx?$/.test(node.source_file);
}

// --- Main -------------------------------------------------------------------

async function main() {
  const graphPath = process.argv[2];
  if (!graphPath) {
    throw new Error(
      'usage: npx tsx scripts/build-content-graph.ts <path-to-graphify-graph.json>',
    );
  }
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required');

  const raw = JSON.parse(fs.readFileSync(path.resolve(graphPath), 'utf8')) as GraphifyGraph;
  const graphifyNodes = raw.nodes ?? [];
  const graphifyLinks = raw.links ?? [];

  // 1. Transform + filter nodes.
  const nodes: GraphNode[] = [];
  let skipped = 0;
  for (const gn of graphifyNodes) {
    if (!isDocNode(gn)) {
      skipped++;
      continue;
    }
    const sourceFile = gn.source_file as string;
    const label = gn.label ?? path.basename(sourceFile);
    nodes.push({
      id: gn.id,
      label,
      url: deriveUrl(normalizeSourceFile(sourceFile)),
      snippet: buildSnippet(sourceFile, label),
      community: typeof gn.community === 'number' ? gn.community : 0,
    });
  }
  console.log(`Nodes: kept ${nodes.length}, skipped ${skipped} (non-doc / no source_file)`);

  // 2. Transform + prune edges (drop dangling endpoints — same invariant as
  //    constrainSubgraph: both endpoints must survive the node filter).
  const kept = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = [];
  let prunedEdges = 0;
  for (const link of graphifyLinks) {
    if (kept.has(link.source) && kept.has(link.target)) {
      edges.push({ source: link.source, target: link.target, relation: link.relation ?? 'related' });
    } else {
      prunedEdges++;
    }
  }
  console.log(`Edges: kept ${edges.length}, pruned ${prunedEdges} (dangling endpoint)`);

  // 3. Embed each node's label + snippet.
  console.log(`Embedding ${nodes.length} nodes with ${MODEL}...`);
  if (nodes.length > 2000) {
    console.warn(
      `  warn: ${nodes.length} nodes exceeds 2000 — embedMany still batches, but this run has a higher API cost.`,
    );
  }
  if (nodes.length === 0) throw new Error('No doc nodes survived filtering — refusing to write empty artifacts.');

  const inputs = nodes.map((n) => `${n.label}\n${n.snippet}`);
  const { embeddings } = await embedMany({ model: openai.embedding(MODEL), values: inputs });
  const vectors: Record<string, number[]> = {};
  nodes.forEach((n, i) => {
    vectors[n.id] = embeddings[i];
  });
  const dim = embeddings[0].length;

  // 4. Write both runtime artifacts (REPLACING the committed fixtures).
  fs.mkdirSync(GRAPH_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(GRAPH_DIR, 'graph.json'),
    JSON.stringify({ nodes, edges }, null, 2) + '\n',
  );
  fs.writeFileSync(
    path.join(GRAPH_DIR, 'embeddings.json'),
    JSON.stringify({ model: MODEL, dim, vectors }, null, 2) + '\n',
  );

  console.log(
    `Wrote graph.json (${nodes.length} nodes, ${edges.length} edges) and embeddings.json (dim ${dim}, ${Object.keys(vectors).length} vectors) to lib/rag/content-graph/`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
