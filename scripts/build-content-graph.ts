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
import { extractContentSections, type SourceMedia } from '../lib/rag/content-sections';
import { findContentLinkEdges, type ArticleBody } from '../lib/rag/content-links';

const GRAPH_DIR = path.join(process.cwd(), 'lib', 'rag', 'content-graph');
const CONTENT_DIR = path.join(process.cwd(), 'content');
const MODEL = 'text-embedding-3-small';

// --- Runtime artifact shapes -------------------------------------------------

interface GraphNode {
  id: string;
  label: string;
  url: string;
  articleUrl: string;
  heading: string;
  anchor: string;
  snippet: string;
  media: SourceMedia[];
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

// --- Helpers ----------------------------------------------------------------

/** Strip a leading `content/` segment so paths resolve the same way regardless
 *  of whether graphify's source_file is repo-relative or content-relative. */
function normalizeSourceFile(sourceFile: string): string {
  return sourceFile.replace(/^content\//, '');
}

/** Read and section an article. Falls back to a one-section label if its source
 * cannot be read, preserving the graph's existing failure behaviour. */
function buildSections(sourceFile: string, label: string, articleUrl: string) {
  const rel = normalizeSourceFile(sourceFile);
  const abs = path.join(CONTENT_DIR, rel);
  try {
    const { data, content } = matter(fs.readFileSync(abs, 'utf8'));
    const title = typeof data.title === 'string' ? data.title : label;
    return { title, body: content, sections: extractContentSections({ url: articleUrl, title, body: content }) };
  } catch {
    console.warn(`  warn: could not read ${abs}; using label section fallback`);
    return { title: label, body: label, sections: extractContentSections({ url: articleUrl, title: label, body: label }) };
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

  // 1. Transform each article into heading-level section nodes. Keeping a map
  // from graphify article IDs to their first section preserves the existing
  // cross-article edges for related-content traversal.
  const nodes: GraphNode[] = [];
  const articleBodies: ArticleBody[] = [];
  const sectionIdsByGraphifyId = new Map<string, string[]>();
  const sectionIdsBySourceFile = new Map<string, string[]>();
  let skipped = 0;
  for (const gn of graphifyNodes) {
    if (!isDocNode(gn)) {
      skipped++;
      continue;
    }
    const sourceFile = gn.source_file as string;
    const label = gn.label ?? path.basename(sourceFile);
    const normalizedSource = normalizeSourceFile(sourceFile);
    const existing = sectionIdsBySourceFile.get(normalizedSource);
    if (existing) {
      sectionIdsByGraphifyId.set(gn.id, existing);
      continue;
    }

    const articleUrl = deriveUrl(normalizedSource);
    const { title, body, sections } = buildSections(sourceFile, label, articleUrl);
    const ids: string[] = [];
    for (const section of sections) {
      const url = section.anchor ? `${articleUrl}#${section.anchor}` : articleUrl;
      const id = url;
      ids.push(id);
      nodes.push({
        id,
        label: title,
        url,
        articleUrl,
        heading: section.heading,
        anchor: section.anchor,
        snippet: section.text,
        media: section.media,
        community: typeof gn.community === 'number' ? gn.community : 0,
      });
    }
    sectionIdsByGraphifyId.set(gn.id, ids);
    sectionIdsBySourceFile.set(normalizedSource, ids);
    articleBodies.push({ articleUrl, body });
  }
  console.log(`Sections: kept ${nodes.length}, skipped ${skipped} (non-doc / no source_file)`);

  // 2. Retain graphify's cross-article links by connecting the first section
  // from each linked article. Section retrieval is direct; these edges remain
  // available for broad related-content traversal.
  const edges: GraphEdge[] = [];
  let prunedEdges = 0;
  for (const link of graphifyLinks) {
    const source = sectionIdsByGraphifyId.get(link.source)?.[0];
    const target = sectionIdsByGraphifyId.get(link.target)?.[0];
    if (source && target) {
      edges.push({ source, target, relation: link.relation ?? 'related' });
    } else {
      prunedEdges++;
    }
  }
  edges.push(...findContentLinkEdges(nodes, articleBodies, edges));
  console.log(`Edges: kept ${edges.length}, pruned ${prunedEdges} (dangling endpoint)`);

  // 3. Embed the section's article title, heading, and complete section text.
  console.log(`Embedding ${nodes.length} nodes with ${MODEL}...`);
  if (nodes.length > 2000) {
    console.warn(
      `  warn: ${nodes.length} nodes exceeds 2000 — embedMany still batches, but this run has a higher API cost.`,
    );
  }
  if (nodes.length === 0) throw new Error('No doc nodes survived filtering — refusing to write empty artifacts.');

  const inputs = nodes.map((n) => `${n.label}\n${n.heading}\n${n.snippet}`);
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
