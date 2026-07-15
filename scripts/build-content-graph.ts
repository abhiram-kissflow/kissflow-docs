/**
 * build-content-graph.ts — regenerate the committed runtime graph artifacts.
 *
 * This script is run MANUALLY (not in CI, not at build time) to replace the
 * fixtures at lib/rag/content-graph/graph.json and lib/rag/content-graph/embeddings.json
 * with the real content knowledge graph.
 *
 * Prerequisites:
 *   1. OPENAI_API_KEY is set in the environment (embeddings are computed via the
 *      OpenAI `text-embedding-3-small` model).
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/build-content-graph.ts
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
import { discoverEnglishContentFiles } from '../lib/rag/content-discovery';

const GRAPH_DIR = path.join(process.cwd(), 'lib', 'rag', 'content-graph');
const CONTENT_DIR = path.join(process.cwd(), 'content');
const MODEL = 'text-embedding-3-small';
const MAX_EMBEDDING_INPUTS = 128;
/** Conservative character estimate with headroom below the provider's 300k cap. */
const MAX_ESTIMATED_EMBEDDING_TOKENS = 200_000;

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
function buildSections(contentDir: string, sourceFile: string, label: string, articleUrl: string) {
  const rel = normalizeSourceFile(sourceFile);
  const abs = path.join(contentDir, rel);
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

export type BuiltSectionGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

export function batchEmbeddingInputs(
  inputs: string[],
  opts: { maxInputs: number; maxEstimatedTokens: number } = {
    maxInputs: MAX_EMBEDDING_INPUTS,
    maxEstimatedTokens: MAX_ESTIMATED_EMBEDDING_TOKENS,
  },
): string[][] {
  const batches: string[][] = [];
  let batch: string[] = [];
  let estimatedTokens = 0;
  for (const input of inputs) {
    const inputTokens = Math.ceil(input.length / 4);
    if (inputTokens > opts.maxEstimatedTokens) {
      throw new Error(
        `A section exceeds the configured embedding token budget (${inputTokens} > ${opts.maxEstimatedTokens}). Split the section before embedding.`,
      );
    }
    const exceedsCount = batch.length >= opts.maxInputs;
    const exceedsTokens = batch.length > 0 && estimatedTokens + inputTokens > opts.maxEstimatedTokens;
    if (exceedsCount || exceedsTokens) {
      batches.push(batch);
      batch = [];
      estimatedTokens = 0;
    }
    batch.push(input);
    estimatedTokens += inputTokens;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

/**
 * Builds section-level graph data from authored documentation. A graphify graph
 * is optional: when omitted, every canonical English MD/MDX article is indexed
 * directly and authored cross-links provide the graph edges.
 */
export function buildSectionGraph(opts: {
  contentDir?: string;
  graphifyGraph?: GraphifyGraph;
} = {}): BuiltSectionGraph {
  const contentDir = opts.contentDir ?? CONTENT_DIR;
  const graphifyNodes = opts.graphifyGraph?.nodes ?? [];
  const graphifyLinks = opts.graphifyGraph?.links ?? [];
  const sourceEntries = graphifyNodes.length
    ? graphifyNodes.filter(isDocNode).map((node) => ({
      id: node.id,
      sourceFile: node.source_file!,
      label: node.label ?? path.basename(node.source_file!),
      community: typeof node.community === 'number' ? node.community : 0,
    }))
    : discoverEnglishContentFiles(contentDir).map((file, index) => ({
      id: path.relative(contentDir, file).split(path.sep).join('/'),
      sourceFile: path.relative(contentDir, file).split(path.sep).join('/'),
      label: path.basename(file),
      community: index,
    }));

  // Transform each article into heading-level section nodes. Keeping a map
  // from source IDs to first sections preserves graphify links when supplied.
  const nodes: GraphNode[] = [];
  const articleBodies: ArticleBody[] = [];
  const sectionIdsByGraphifyId = new Map<string, string[]>();
  const sectionIdsBySourceFile = new Map<string, string[]>();
  for (const entry of sourceEntries) {
    const sourceFile = entry.sourceFile;
    const label = entry.label;
    const normalizedSource = normalizeSourceFile(sourceFile);
    const existing = sectionIdsBySourceFile.get(normalizedSource);
    if (existing) {
      sectionIdsByGraphifyId.set(entry.id, existing);
      continue;
    }

    const articleUrl = deriveUrl(normalizedSource);
    const { title, body, sections } = buildSections(contentDir, sourceFile, label, articleUrl);
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
        community: entry.community,
      });
    }
    sectionIdsByGraphifyId.set(entry.id, ids);
    sectionIdsBySourceFile.set(normalizedSource, ids);
    articleBodies.push({ articleUrl, body });
  }
  // Retain graphify's cross-article links by connecting the first section
  // from each linked article. Section retrieval is direct; these edges remain
  // available for broad related-content traversal.
  const edges: GraphEdge[] = [];
  for (const link of graphifyLinks) {
    const source = sectionIdsByGraphifyId.get(link.source)?.[0];
    const target = sectionIdsByGraphifyId.get(link.target)?.[0];
    if (source && target) {
      edges.push({ source, target, relation: link.relation ?? 'related' });
    }
  }
  edges.push(...findContentLinkEdges(nodes, articleBodies, edges));
  if (nodes.length === 0) throw new Error('No doc nodes survived filtering — refusing to write empty artifacts.');
  return { nodes, edges };
}

// --- Main -------------------------------------------------------------------

async function main() {
  const graphPath = process.argv[2];
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required');
  const graphifyGraph = graphPath
    ? JSON.parse(fs.readFileSync(path.resolve(graphPath), 'utf8')) as GraphifyGraph
    : undefined;
  const { nodes, edges } = buildSectionGraph({ graphifyGraph });
  console.log(`Sections: kept ${nodes.length}, graphify skipped ${graphifyGraph ? (graphifyGraph.nodes.length - graphifyGraph.nodes.filter(isDocNode).length) : 0}`);
  console.log(`Edges: kept ${edges.length}${graphifyGraph ? '' : ' (direct authored-link mode)'}`);

  // Embed the section's article title, heading, and complete section text.
  console.log(`Embedding ${nodes.length} nodes with ${MODEL}...`);
  if (nodes.length > 2000) {
    console.warn(
      `  warn: ${nodes.length} nodes exceeds 2000 — embedMany still batches, but this run has a higher API cost.`,
    );
  }
  const inputs = nodes.map((n) => `${n.label}\n${n.heading}\n${n.snippet}`);
  const batches = batchEmbeddingInputs(inputs);
  console.log(`Embedding in ${batches.length} bounded request(s)...`);
  const embeddings: number[][] = [];
  for (const values of batches) {
    const result = await embedMany({ model: openai.embedding(MODEL), values });
    embeddings.push(...result.embeddings);
  }
  if (embeddings.length !== nodes.length) {
    throw new Error(`Embedding count mismatch: expected ${nodes.length}, got ${embeddings.length}`);
  }
  const vectors: Record<string, number[]> = {};
  nodes.forEach((n, i) => {
    vectors[n.id] = embeddings[i];
  });
  const dim = embeddings[0].length;

  // Write both runtime artifacts (REPLACING the committed fixtures).
  fs.mkdirSync(GRAPH_DIR, { recursive: true });
  const artifactGraphPath = path.join(GRAPH_DIR, 'graph.json');
  const embeddingsPath = path.join(GRAPH_DIR, 'embeddings.json');
  const graphTemp = `${artifactGraphPath}.${process.pid}.tmp`;
  const embeddingsTemp = `${embeddingsPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(graphTemp, JSON.stringify({ nodes, edges }, null, 2) + '\n');
    fs.writeFileSync(embeddingsTemp, JSON.stringify({ model: MODEL, dim, vectors }, null, 2) + '\n');
    fs.renameSync(graphTemp, artifactGraphPath);
    fs.renameSync(embeddingsTemp, embeddingsPath);
  } finally {
    for (const temp of [graphTemp, embeddingsTemp]) {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }

  console.log(
    `Wrote graph.json (${nodes.length} nodes, ${edges.length} edges) and embeddings.json (dim ${dim}, ${Object.keys(vectors).length} vectors) to lib/rag/content-graph/`,
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
