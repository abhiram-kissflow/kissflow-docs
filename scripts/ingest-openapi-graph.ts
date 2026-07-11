/**
 * Ingests the Kissflow OpenAPI spec into the RAG content graph so the answer
 * engine can retrieve real API endpoints (not just point at the reference page).
 *
 * Each operation becomes a node: id `api:{method}:{path}`, cited to /api-reference
 * (per-operation deep-links aren't wired in Scalar yet — a follow-up). Re-runnable:
 * existing `api:` nodes/vectors are dropped before re-adding.
 *
 * Run: set -a; source .env.local; set +a; npx tsx scripts/ingest-openapi-graph.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

const MODEL = 'text-embedding-3-small';
const SPEC = path.join(process.cwd(), 'public', 'openapi', 'kissflow-api.json');
const GRAPH_DIR = path.join(process.cwd(), 'lib', 'rag', 'content-graph');
const API_URL = '/api-reference';
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

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

/* eslint-disable @typescript-eslint/no-explicit-any */
function inlineProps(schema: any): string[] {
  const s = schema?.properties ? schema : schema?.items ?? schema;
  return s?.properties ? Object.keys(s.properties) : [];
}

function buildSnippet(tag: string, method: string, p: string, op: any, sharedParams: any[]): string {
  const params = [...sharedParams, ...(op.parameters ?? [])];
  const lines: string[] = [`Kissflow API — ${tag}`, `${method.toUpperCase()} ${p}`];
  if (op.summary) lines.push(op.summary);
  if (op.description) lines.push(op.description);
  if (params.length) {
    lines.push(
      'Parameters: ' +
        params
          .map((pr: any) => `${pr.name} (${pr.in})${pr.description ? ` — ${pr.description}` : ''}`)
          .join('; '),
    );
  }
  const body = op.requestBody;
  if (body) {
    const schema = body.content?.['application/json']?.schema;
    const props = schema ? inlineProps(schema) : [];
    const desc = body.description ? `${body.description}. ` : '';
    lines.push(`Request body: ${desc}${props.length ? `Fields: ${props.join(', ')}` : ''}`.trim());
  }
  if (op.responses) lines.push('Responses: ' + Object.keys(op.responses).join(', '));
  return lines.filter(Boolean).join('\n').slice(0, 1500);
}

async function main() {
  const spec: any = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
  const paths = spec.paths ?? {};

  const apiNodes: Node[] = [];
  for (const [p, methods] of Object.entries<any>(paths)) {
    const sharedParams = methods.parameters ?? [];
    for (const [method, op] of Object.entries<any>(methods)) {
      if (!HTTP_METHODS.has(method)) continue;
      const tag = op.tags?.[0] ?? 'API';
      const summary = op.summary ?? `${method.toUpperCase()} ${p}`;
      apiNodes.push({
        id: `api:${method}:${p}`,
        label: `${method.toUpperCase()} ${p} — ${summary}`,
        url: API_URL,
        snippet: buildSnippet(tag, method, p, op, sharedParams),
        community: 0, // set below to a fresh community id
      });
    }
  }
  if (!apiNodes.length) throw new Error('no operations parsed from OpenAPI spec');

  const graph = JSON.parse(fs.readFileSync(path.join(GRAPH_DIR, 'graph.json'), 'utf8')) as Graph;
  const emb = JSON.parse(fs.readFileSync(path.join(GRAPH_DIR, 'embeddings.json'), 'utf8')) as Embeddings;

  // Re-runnable: drop any prior API nodes + vectors.
  graph.nodes = graph.nodes.filter((n) => !n.id.startsWith('api:'));
  for (const k of Object.keys(emb.vectors)) if (k.startsWith('api:')) delete emb.vectors[k];

  const apiCommunity = Math.max(0, ...graph.nodes.map((n) => n.community)) + 1;
  apiNodes.forEach((n) => (n.community = apiCommunity));

  console.log(`parsed ${apiNodes.length} API operations, embedding…`);
  const { embeddings } = await embedMany({
    model: openai.embedding(MODEL),
    values: apiNodes.map((n) => `${n.label}\n${n.snippet}`),
  });
  if (embeddings[0].length !== emb.dim) {
    throw new Error(`embedding dim ${embeddings[0].length} != graph dim ${emb.dim}`);
  }
  apiNodes.forEach((n, i) => (emb.vectors[n.id] = embeddings[i]));

  graph.nodes.push(...apiNodes);

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
