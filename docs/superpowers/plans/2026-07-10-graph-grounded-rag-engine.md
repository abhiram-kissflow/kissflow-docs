# Graph-Grounded RAG Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a graph-grounded RAG engine with two API surfaces — an end-user path grounded in a new content knowledge graph, and a developer path grounded in the existing codebase route-snapshot — that constrain retrieved context, force citations to node IDs via structured output, abstain when evidence is insufficient, and escalate model tier (Luna→Terra) on concrete complexity signals.

**Architecture:** Two Next.js API routes (`/api/rag/ask`, `/api/rag/dev-ask`) over a shared core (`lib/rag/`): citation schema, escalation decision, content-graph runtime (semantic seed search + bounded traversal over a committed graph+embeddings artifact), model router, and a shared answer step (`streamObject` with the citation schema). The engine is built and tested against a small real-embedding fixture graph first; the full graphify-built content graph over `content/` (an LLM-extraction job) is swapped in as a late, isolated task so the engine is never blocked on it.

**Tech Stack:** Next.js App Router, `ai` SDK v6 (`embed`/`embedMany`/`cosineSimilarity`/`streamObject`), `@ai-sdk/openai` (embedding model + GPT-5.6 chat models), `zod` v4, Node's built-in `node:test`, `graphify` (offline content-graph build only).

## Global Constraints

- Implements `docs/superpowers/specs/2026-07-10-graph-grounded-rag-engine-design.md`. The hero page UI and swapping `/api/chat`'s retrieval are a SEPARATE later spec — out of scope here.
- Model identifiers (verified against OpenAI docs 2026-07-10): default answering `gpt-5.6-luna`; escalation `gpt-5.6-terra`; developer graph-query generation `gpt-5.3-codex`. Embeddings: `text-embedding-3-small`. All passed as plain strings to `openai(...)` / `openai.embedding(...)` — the SDK's `(string & {})` model-id fallback accepts ids newer than this `@ai-sdk/openai@3.0.82` build, so no version bump is needed.
- Grounding contract, non-negotiable and identical on both paths: the model sees ONLY the constrained subgraph (nodes/edges + snippets), MUST cite the node IDs it used, and MUST return `insufficientEvidence: true` rather than answer from outside the provided context. Enforced structurally via `streamObject` + the Zod citation schema, never by prose instruction alone.
- No new runtime dependencies — `ai`, `@ai-sdk/openai`, `zod` are already installed. No new hosted database (vector index is a bundled in-memory file).
- No new test framework — use Node's built-in `node:test` + `node:assert/strict`, run via `npx tsx --test <file>`, exactly as the earlier API-reference work did.
- Do NOT modify `/api/chat`, `components/ai-chat.tsx`, `components/ai-chat-launcher.tsx`, `lib/rag/help.ts`, or `lib/rag/graph.ts` (the last is CONSUMED by the dev path, not changed). Do NOT touch the `content/` docs or the existing `/docs` tree.
- `graphify` doc extraction over MDX is LLM-driven (Gemini or subagent dispatch), NOT the deterministic AST path used for code — building the real content graph (Task 7) is a bounded LLM-cost job, isolated deliberately so Tasks 1–6 never depend on it.
- Runtime graph artifact shape (both fixture and real build conform to this — the build script transforms graphify's raw node-link output into it):
  ```
  // lib/rag/content-graph/graph.json
  { "nodes": [ { "id": string, "label": string, "url": string, "snippet": string, "community": number } ],
    "edges": [ { "source": string, "target": string, "relation": string } ] }
  // lib/rag/content-graph/embeddings.json
  { "model": string, "dim": number, "vectors": { "<nodeId>": number[] } }
  ```

---

### Task 1: Citation schema + escalation decision (TDD)

**Files:**
- Create: `lib/rag/citation-schema.ts`
- Create: `lib/rag/escalation.ts`
- Create: `lib/rag/escalation.test.ts`

**Interfaces:**
- Produces: `citationAnswerSchema` (Zod), `CitationAnswer` (type); `decideModelTier(input: EscalationInput): 'luna' | 'terra'` and the `EscalationInput`/`SeedScore`/`SubgraphStats` types (consumed by Tasks 4, 5, 6).

- [ ] **Step 1: Write the citation schema**

Create `lib/rag/citation-schema.ts`:

```ts
import { z } from 'zod';

/**
 * The structured answer contract enforced on every RAG response, on both the
 * end-user and developer paths. The model must either cite the graph node IDs
 * it grounded the answer in, or set insufficientEvidence and explain what is
 * missing — it may never answer from outside the provided constrained context.
 */
export const citationAnswerSchema = z.object({
  answer: z.string().describe('The grounded answer. Empty string if insufficientEvidence is true.'),
  citations: z
    .array(
      z.object({
        nodeId: z.string().describe('ID of a graph node from the provided context that supports the answer.'),
        snippet: z.string().describe('The exact snippet text from that node used as evidence.'),
      }),
    )
    .describe('Every node whose content the answer relies on. Empty if insufficientEvidence is true.'),
  insufficientEvidence: z
    .boolean()
    .describe('True when the provided context does not support a confident answer.'),
});

export type CitationAnswer = z.infer<typeof citationAnswerSchema>;
```

- [ ] **Step 2: Write the failing escalation test**

Create `lib/rag/escalation.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideModelTier } from './escalation';

const baseSeeds = [
  { nodeId: 'a', score: 0.82 },
  { nodeId: 'b', score: 0.55 },
];
const baseStats = { maxSeedHopDistance: 1, distinctSourceArticles: 2 };

test('stays on luna for a clear, shallow, narrow query', () => {
  assert.equal(decideModelTier({ seeds: baseSeeds, subgraph: baseStats }), 'luna');
});

test('escalates to terra on multi-hop traversal', () => {
  assert.equal(
    decideModelTier({ seeds: baseSeeds, subgraph: { ...baseStats, maxSeedHopDistance: 2 } }),
    'terra',
  );
});

test('escalates to terra on ambiguous seeds (top scores clustered)', () => {
  const ambiguous = [
    { nodeId: 'a', score: 0.80 },
    { nodeId: 'b', score: 0.78 },
  ];
  assert.equal(decideModelTier({ seeds: ambiguous, subgraph: baseStats }), 'terra');
});

test('does not treat clustered-but-low scores as ambiguous', () => {
  const bothLow = [
    { nodeId: 'a', score: 0.20 },
    { nodeId: 'b', score: 0.19 },
  ];
  assert.equal(decideModelTier({ seeds: bothLow, subgraph: baseStats }), 'luna');
});

test('escalates to terra on broad synthesis (many distinct source articles)', () => {
  assert.equal(
    decideModelTier({ seeds: baseSeeds, subgraph: { ...baseStats, distinctSourceArticles: 6 } }),
    'terra',
  );
});

test('handles a single seed without throwing', () => {
  assert.equal(decideModelTier({ seeds: [{ nodeId: 'a', score: 0.9 }], subgraph: baseStats }), 'luna');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx tsx --test lib/rag/escalation.test.ts`
Expected: FAIL — `Cannot find module './escalation'`

- [ ] **Step 4: Write the escalation implementation**

Create `lib/rag/escalation.ts`:

```ts
export interface SeedScore {
  nodeId: string;
  /** Cosine similarity of the query against this seed node, in [-1, 1]. */
  score: number;
}

export interface SubgraphStats {
  /** Largest number of hops any seed needed to reach a citation-worthy node. */
  maxSeedHopDistance: number;
  /** Number of distinct source articles the constrained subgraph spans. */
  distinctSourceArticles: number;
}

export interface EscalationInput {
  seeds: SeedScore[];
  subgraph: SubgraphStats;
}

/** Tunable thresholds — defaults chosen to be revisited against real queries. */
export const ESCALATION = {
  /** Seeds are "ambiguous" only when both are relevant (above this floor)... */
  ambiguityScoreFloor: 0.5,
  /** ...and their scores are within this band of each other. */
  ambiguityScoreBand: 0.05,
  /** More than one hop from a seed to evidence signals multi-hop reasoning. */
  maxHopsBeforeEscalation: 1,
  /** Spanning more than this many source articles signals broad synthesis. */
  maxArticlesBeforeEscalation: 5,
} as const;

/**
 * Turns the qualitative escalation triggers (multi-hop reasoning, ambiguity,
 * broad synthesis) into concrete signals. Returns the model tier to use.
 * Pure — no I/O.
 */
export function decideModelTier({ seeds, subgraph }: EscalationInput): 'luna' | 'terra' {
  // Multi-hop: evidence was more than one hop from the seeds.
  if (subgraph.maxSeedHopDistance > ESCALATION.maxHopsBeforeEscalation) return 'terra';

  // Broad synthesis: the answer must reconcile many distinct articles.
  if (subgraph.distinctSourceArticles > ESCALATION.maxArticlesBeforeEscalation) return 'terra';

  // Ambiguity: the top two relevant seeds are nearly tied, so seed search
  // could not confidently pick a single best match.
  const sorted = [...seeds].sort((a, b) => b.score - a.score);
  if (sorted.length >= 2) {
    const [top, second] = sorted;
    const bothRelevant = second.score >= ESCALATION.ambiguityScoreFloor;
    const clustered = top.score - second.score < ESCALATION.ambiguityScoreBand;
    if (bothRelevant && clustered) return 'terra';
  }

  return 'luna';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx tsx --test lib/rag/escalation.test.ts`
Expected: PASS — `6 tests passed`

- [ ] **Step 6: Commit**

```bash
git add lib/rag/citation-schema.ts lib/rag/escalation.ts lib/rag/escalation.test.ts
git commit -m "feat: add RAG citation schema and model-escalation decision"
```

---

### Task 2: Content-graph runtime module + real-embedding fixture (TDD)

**Files:**
- Create: `lib/rag/content-graph.ts`
- Create: `lib/rag/content-graph.test.ts`
- Create: `lib/rag/content-graph/graph.json` (fixture — 6–8 real nodes; replaced by Task 7's real build)
- Create: `scripts/build-fixture-embeddings.ts` (generates the fixture's `embeddings.json` via the real embedding API)
- Create: `lib/rag/content-graph/embeddings.json` (fixture, generated by the script above)

**Interfaces:**
- Consumes: the graph artifact shape from Global Constraints.
- Produces: `loadContentGraph()`, `seedSearch(queryVector: number[], k: number): SeedHit[]`, `constrainSubgraph(seedNodeIds: string[], opts): ConstrainedSubgraph`, and the `SeedHit`/`ConstrainedSubgraph`/`GraphNode` types (consumed by Task 5). `constrainSubgraph` returns both the collected nodes/edges AND a `SubgraphStats` (for Task 1's `decideModelTier`).

- [ ] **Step 1: Write the failing test (against injected synthetic vectors — no API)**

Create `lib/rag/content-graph.test.ts`. The traversal/search functions take vectors and a graph as arguments so tests inject a tiny deterministic graph with dim-3 vectors (no embedding API needed):

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedSearch, constrainSubgraph, type ContentGraph } from './content-graph';

const graph: ContentGraph = {
  nodes: [
    { id: 'n1', label: 'A', url: '/docs/a', snippet: 'a', community: 0 },
    { id: 'n2', label: 'B', url: '/docs/b', snippet: 'b', community: 0 },
    { id: 'n3', label: 'C', url: '/docs/c', snippet: 'c', community: 1 },
    { id: 'n4', label: 'D', url: '/docs/d', snippet: 'd', community: 1 },
  ],
  edges: [
    { source: 'n1', target: 'n2', relation: 'related' },
    { source: 'n2', target: 'n3', relation: 'related' },
    { source: 'n3', target: 'n4', relation: 'related' },
  ],
};

const vectors: Record<string, number[]> = {
  n1: [1, 0, 0],
  n2: [0.9, 0.1, 0],
  n3: [0, 1, 0],
  n4: [0, 0, 1],
};

test('seedSearch returns nodes ranked by cosine similarity to the query', () => {
  const hits = seedSearch([1, 0, 0], 2, graph, vectors);
  assert.equal(hits[0].nodeId, 'n1');
  assert.equal(hits[1].nodeId, 'n2');
  assert.ok(hits[0].score >= hits[1].score);
});

test('constrainSubgraph does bounded BFS from seeds and reports hop distance', () => {
  const result = constrainSubgraph(['n1'], { maxNodes: 10, maxHops: 2 }, graph);
  const ids = result.nodes.map((n) => n.id).sort();
  assert.deepEqual(ids, ['n1', 'n2', 'n3']); // n4 is 3 hops away, excluded by maxHops:2
  assert.equal(result.stats.maxSeedHopDistance, 2);
});

test('constrainSubgraph respects maxNodes cap', () => {
  const result = constrainSubgraph(['n1'], { maxNodes: 2, maxHops: 5 }, graph);
  assert.equal(result.nodes.length, 2);
});

test('constrainSubgraph counts distinct source articles by url', () => {
  const result = constrainSubgraph(['n1'], { maxNodes: 10, maxHops: 2 }, graph);
  assert.equal(result.stats.distinctSourceArticles, 3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test lib/rag/content-graph.test.ts`
Expected: FAIL — `Cannot find module './content-graph'`

- [ ] **Step 3: Write the implementation**

Create `lib/rag/content-graph.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { cosineSimilarity } from 'ai';
import type { SubgraphStats } from './escalation';

export interface GraphNode {
  id: string;
  label: string;
  url: string;
  snippet: string;
  community: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface ContentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface EmbeddingIndex {
  model: string;
  dim: number;
  vectors: Record<string, number[]>;
}

export interface SeedHit {
  nodeId: string;
  score: number;
}

export interface ConstrainedSubgraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: SubgraphStats;
}

interface LoadedGraph {
  graph: ContentGraph;
  index: EmbeddingIndex;
}

let cache: LoadedGraph | null = null;

const GRAPH_DIR = path.join(process.cwd(), 'lib', 'rag', 'content-graph');

/** Loads and caches the committed graph + embedding index. Throws loudly if missing/malformed. */
export function loadContentGraph(): LoadedGraph {
  if (cache) return cache;
  const graph = JSON.parse(fs.readFileSync(path.join(GRAPH_DIR, 'graph.json'), 'utf8')) as ContentGraph;
  const index = JSON.parse(
    fs.readFileSync(path.join(GRAPH_DIR, 'embeddings.json'), 'utf8'),
  ) as EmbeddingIndex;
  if (!Array.isArray(graph.nodes) || !graph.nodes.length) {
    throw new Error('content-graph: graph.json has no nodes');
  }
  if (!index.vectors || Object.keys(index.vectors).length === 0) {
    throw new Error('content-graph: embeddings.json has no vectors');
  }
  cache = { graph, index };
  return cache;
}

/**
 * Ranks graph nodes by cosine similarity of their embedding to the query vector.
 * Graph + vectors are injectable for testing; default to the loaded singleton.
 */
export function seedSearch(
  queryVector: number[],
  k: number,
  graph?: ContentGraph,
  vectors?: Record<string, number[]>,
): SeedHit[] {
  const loaded = graph && vectors ? { graph, vectors } : (() => {
    const l = loadContentGraph();
    return { graph: l.graph, vectors: l.index.vectors };
  })();

  return loaded.graph.nodes
    .map((node) => {
      const vec = loaded.vectors[node.id];
      return vec ? { nodeId: node.id, score: cosineSimilarity(queryVector, vec) } : null;
    })
    .filter((h): h is SeedHit => h !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Bounded breadth-first traversal from the seed nodes. Collects reachable nodes
 * and edges up to maxHops, capped at maxNodes, and reports the stats the
 * escalation decision needs.
 */
export function constrainSubgraph(
  seedNodeIds: string[],
  opts: { maxNodes: number; maxHops: number },
  graph?: ContentGraph,
): ConstrainedSubgraph {
  const g = graph ?? loadContentGraph().graph;
  const nodeById = new Map(g.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, GraphEdge[]>();
  for (const edge of g.edges) {
    (adjacency.get(edge.source) ?? adjacency.set(edge.source, []).get(edge.source)!).push(edge);
    (adjacency.get(edge.target) ?? adjacency.set(edge.target, []).get(edge.target)!).push(edge);
  }

  const distance = new Map<string, number>();
  const collectedNodes: GraphNode[] = [];
  const collectedEdges: GraphEdge[] = [];
  const queue: string[] = [];

  for (const id of seedNodeIds) {
    if (nodeById.has(id) && !distance.has(id)) {
      distance.set(id, 0);
      queue.push(id);
    }
  }

  let maxHop = 0;
  while (queue.length && collectedNodes.length < opts.maxNodes) {
    const id = queue.shift()!;
    const node = nodeById.get(id);
    if (!node) continue;
    collectedNodes.push(node);
    const hop = distance.get(id)!;
    maxHop = Math.max(maxHop, hop);
    if (hop >= opts.maxHops) continue;

    for (const edge of adjacency.get(id) ?? []) {
      const neighbor = edge.source === id ? edge.target : edge.source;
      if (!distance.has(neighbor) && nodeById.has(neighbor)) {
        distance.set(neighbor, hop + 1);
        queue.push(neighbor);
        collectedEdges.push(edge);
      }
    }
  }

  const distinctSourceArticles = new Set(collectedNodes.map((n) => n.url)).size;
  return {
    nodes: collectedNodes,
    edges: collectedEdges,
    stats: { maxSeedHopDistance: maxHop, distinctSourceArticles },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test lib/rag/content-graph.test.ts`
Expected: PASS — `4 tests passed`

- [ ] **Step 5: Author the fixture graph**

Create `lib/rag/content-graph/graph.json` with 6–8 real nodes drawn from actual `content/` articles (pick a connected cluster, e.g. a few get-started + a couple develop/api pages), each with a real `url` and a real 1–2 sentence `snippet` from that article, and a handful of `edges` between them. This is a stand-in the routes can run against with REAL query embeddings until Task 7 replaces it. Example shape (fill with real content):

```json
{
  "nodes": [
    { "id": "get-started-welcome", "label": "What is Kissflow", "url": "/docs/get-started/welcome", "snippet": "An overview of the Kissflow platform — what it does, who it's for, and how to get started.", "community": 0 }
  ],
  "edges": [
    { "source": "get-started-welcome", "target": "get-started-quickstart-users", "relation": "related" }
  ]
}
```

- [ ] **Step 6: Write and run the fixture-embedding generator**

Create `scripts/build-fixture-embeddings.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

const GRAPH_DIR = path.join(process.cwd(), 'lib', 'rag', 'content-graph');
const MODEL = 'text-embedding-3-small';

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required');
  const graph = JSON.parse(fs.readFileSync(path.join(GRAPH_DIR, 'graph.json'), 'utf8')) as {
    nodes: { id: string; label: string; snippet: string }[];
  };
  const inputs = graph.nodes.map((n) => `${n.label}\n${n.snippet}`);
  const { embeddings } = await embedMany({ model: openai.embedding(MODEL), values: inputs });
  const vectors: Record<string, number[]> = {};
  graph.nodes.forEach((n, i) => {
    vectors[n.id] = embeddings[i];
  });
  const index = { model: MODEL, dim: embeddings[0].length, vectors };
  fs.writeFileSync(path.join(GRAPH_DIR, 'embeddings.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`Wrote ${graph.nodes.length} embeddings (dim ${index.dim}) to embeddings.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Run: `npx tsx scripts/build-fixture-embeddings.ts`
Expected: `Wrote N embeddings (dim 1536) to embeddings.json`, and `lib/rag/content-graph/embeddings.json` exists with dim 1536.

- [ ] **Step 7: Commit**

```bash
git add lib/rag/content-graph.ts lib/rag/content-graph.test.ts scripts/build-fixture-embeddings.ts lib/rag/content-graph/graph.json lib/rag/content-graph/embeddings.json
git commit -m "feat: add content-graph runtime (seed search + bounded traversal) with real-embedding fixture"
```

---

### Task 3: Model router

**Files:**
- Create: `lib/rag/model-router.ts`

**Interfaces:**
- Consumes: the `'luna' | 'terra'` tier from Task 1.
- Produces: `resolveAnswerModel(tier)` and `DEV_QUERY_MODEL` (consumed by Tasks 4, 6).

- [ ] **Step 1: Write the module**

Create `lib/rag/model-router.ts`:

```ts
import { openai } from '@ai-sdk/openai';

/** Verified OpenAI model ids (2026-07-10). Passed as strings via the SDK's
 *  (string & {}) fallback since GPT-5.6 postdates this @ai-sdk/openai build. */
export const RAG_MODELS = {
  luna: 'gpt-5.6-luna',
  terra: 'gpt-5.6-terra',
  devQuery: 'gpt-5.3-codex',
  embedding: 'text-embedding-3-small',
} as const;

export function resolveAnswerModel(tier: 'luna' | 'terra') {
  return openai(RAG_MODELS[tier]);
}

export const DEV_QUERY_MODEL = openai(RAG_MODELS.devQuery);
export const EMBEDDING_MODEL = openai.embedding(RAG_MODELS.embedding);
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors from `model-router.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/rag/model-router.ts
git commit -m "feat: add RAG model router (Luna/Terra/Codex/embedding)"
```

---

### Task 4: Shared answer step

**Files:**
- Create: `lib/rag/answer.ts`

**Interfaces:**
- Consumes: `citationAnswerSchema` (Task 1), `resolveAnswerModel` (Task 3), a `ConstrainedSubgraph` (Task 2) or an equivalent context list.
- Produces: `answerFromContext({ query, contextNodes, tier })` → the `streamObject` result (consumed by Tasks 5, 6). Streaming preserved via `streamObject`'s partial-object stream.

- [ ] **Step 1: Write the module**

Create `lib/rag/answer.ts`:

```ts
import { streamObject } from 'ai';
import { citationAnswerSchema } from './citation-schema';
import { resolveAnswerModel } from './model-router';

export interface ContextNode {
  id: string;
  label: string;
  url: string;
  snippet: string;
}

const SYSTEM = `You are Kissflow's grounded answering engine.

You are given a constrained set of knowledge-graph nodes as CONTEXT. Each node
has an id, a source url, and a snippet.

Rules, in priority order:
1. Answer ONLY from the provided CONTEXT. Never use outside knowledge.
2. Every claim in your answer must be supported by a node you cite by its id,
   with the exact snippet you relied on.
3. If the CONTEXT does not contain enough information to answer confidently,
   set insufficientEvidence to true, leave answer empty and citations empty,
   and do not guess.
4. Keep answers concise and directly responsive to the question.`;

function renderContext(nodes: ContextNode[]): string {
  if (!nodes.length) return 'CONTEXT: (empty)';
  return [
    'CONTEXT:',
    ...nodes.map((n) => `- id: ${n.id}\n  url: ${n.url}\n  title: ${n.label}\n  snippet: ${n.snippet}`),
  ].join('\n');
}

/**
 * Runs the grounded, citation-enforced answer over a constrained context.
 * Returns the streamObject result so callers can stream the partial object.
 */
export function answerFromContext(input: {
  query: string;
  contextNodes: ContextNode[];
  tier: 'luna' | 'terra';
}) {
  return streamObject({
    model: resolveAnswerModel(input.tier),
    schema: citationAnswerSchema,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'system', content: renderContext(input.contextNodes) },
      { role: 'user', content: input.query },
    ],
  });
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/rag/answer.ts
git commit -m "feat: add shared grounded-answer step (streamObject + citation schema)"
```

---

### Task 5: End-user path — `/api/rag/ask`

**Files:**
- Create: `app/api/rag/ask/route.ts`

**Interfaces:**
- Consumes: `EMBEDDING_MODEL` (Task 3), `seedSearch`/`constrainSubgraph` (Task 2), `decideModelTier` (Task 1), `answerFromContext` (Task 4).
- Produces: `POST /api/rag/ask` streaming `{ answer, citations, insufficientEvidence }`.

- [ ] **Step 1: Write the route**

Create `app/api/rag/ask/route.ts`:

```ts
import { embed } from 'ai';
import { EMBEDDING_MODEL } from '@/lib/rag/model-router';
import { seedSearch, constrainSubgraph, loadContentGraph } from '@/lib/rag/content-graph';
import { decideModelTier } from '@/lib/rag/escalation';
import { answerFromContext, type ContextNode } from '@/lib/rag/answer';

export const runtime = 'nodejs';

const SEED_K = 6;
const MAX_NODES = 12;
const MAX_HOPS = 2;
const SEED_SCORE_FLOOR = 0.2;

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  let body: { query?: string };
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const query = body.query?.trim() ?? '';
  if (query.length < 2) {
    return Response.json({ error: 'query must be at least 2 characters' }, { status: 400 });
  }

  const { graph, index } = loadContentGraph();
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: query });
  const seeds = seedSearch(embedding, SEED_K, graph, index.vectors);

  // Honest short-circuit: nothing relevant retrieved → abstain without a model call.
  if (!seeds.length || seeds[0].score < SEED_SCORE_FLOOR) {
    return Response.json({ answer: '', citations: [], insufficientEvidence: true });
  }

  const constrained = constrainSubgraph(
    seeds.map((s) => s.nodeId),
    { maxNodes: MAX_NODES, maxHops: MAX_HOPS },
    graph,
  );
  const tier = decideModelTier({ seeds, subgraph: constrained.stats });
  const contextNodes: ContextNode[] = constrained.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    url: n.url,
    snippet: n.snippet,
  }));

  const result = answerFromContext({ query, contextNodes, tier });
  return result.toTextStreamResponse();
}
```

Note: this relies on Task 2's `loadContentGraph()` returning `{ graph, index }` (it does — that's its defined `LoadedGraph` shape), so `index.vectors` is available to pass into `seedSearch`. No change to Task 2 needed; just confirm the import resolves.

- [ ] **Step 2: Verify it type-checks and builds the route**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Manual verification against the fixture graph**

Start the dev server (`npm run dev`; if port 3000 is busy note the actual port). Then:

Run: `curl -s -X POST http://localhost:3000/api/rag/ask -H 'content-type: application/json' -d '{"query":"What is Kissflow?"}'`
Expected: a streamed JSON object ending as `{ "answer": "...", "citations": [ { "nodeId": "...", "snippet": "..." } ], "insufficientEvidence": false }`, where the cited nodeIds exist in the fixture `graph.json`.

Run an out-of-scope query: `curl -s -X POST http://localhost:3000/api/rag/ask -H 'content-type: application/json' -d '{"query":"What is the airspeed velocity of an unladen swallow?"}'`
Expected: `insufficientEvidence: true` (either via the seed-floor short-circuit or the model abstaining).

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add app/api/rag/ask/route.ts lib/rag/content-graph.ts
git commit -m "feat: add /api/rag/ask end-user grounded RAG route"
```

---

### Task 6: Developer path — `/api/rag/dev-ask`

**Files:**
- Create: `app/api/rag/dev-ask/route.ts`

**Interfaces:**
- Consumes: `DEV_QUERY_MODEL` (Task 3), `searchFrontendGraph`/`searchBackendGraph`/`GRAPH_OVERVIEW` (existing `lib/rag/graph.ts`, unchanged), `decideModelTier` (Task 1), `answerFromContext` (Task 4). Reuses the `/api/graph/query` auth pattern.
- Produces: `POST /api/rag/dev-ask` (API-key protected) streaming the citation-schema answer.

- [ ] **Step 1: Write the route**

Create `app/api/rag/dev-ask/route.ts`. It reuses the exact origin-check + bearer-key gate from `app/api/graph/query/route.ts` (copy those two helper functions — `isAllowedOrigin`, `hasValidApiKey` — verbatim; they read `GRAPH_QUERY_ALLOWED_ORIGINS` / `GRAPH_QUERY_API_KEY`), then:

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { DEV_QUERY_MODEL } from '@/lib/rag/model-router';
import { searchFrontendGraph, searchBackendGraph, GRAPH_OVERVIEW } from '@/lib/rag/graph';
import { decideModelTier } from '@/lib/rag/escalation';
import { answerFromContext, type ContextNode } from '@/lib/rag/answer';

export const runtime = 'nodejs';

// --- paste isAllowedOrigin(request) and hasValidApiKey(request) verbatim from
//     app/api/graph/query/route.ts here ---

const devQuerySchema = z.object({
  source: z.enum(['frontend', 'backend', 'both']),
  terms: z.string().describe('Space-separated search terms for the codebase route graph.'),
  limit: z.number().int().min(1).max(25),
});

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  if (!hasValidApiKey(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });

  let body: { query?: string };
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const query = body.query?.trim() ?? '';
  if (query.length < 2) return Response.json({ error: 'query must be at least 2 characters' }, { status: 400 });

  // gpt-5.3-codex turns the NL question into a structured graph query.
  let gen;
  try {
    gen = await generateObject({
      model: DEV_QUERY_MODEL,
      schema: devQuerySchema,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Generate a codebase route-graph query for the question. Overview: ${JSON.stringify(GRAPH_OVERVIEW)}`,
        },
        { role: 'user', content: query },
      ],
    });
  } catch {
    return Response.json({ error: 'Could not generate a graph query' }, { status: 502 });
  }

  const { source, terms, limit } = gen.object;
  const frontend = source === 'backend' ? [] : searchFrontendGraph(terms, limit);
  const backend = source === 'frontend' ? [] : searchBackendGraph(terms, limit);
  const hits = [...frontend, ...backend];

  if (!hits.length) return Response.json({ answer: '', citations: [], insufficientEvidence: true });

  // Each route hit becomes a citable context node.
  const contextNodes: ContextNode[] = hits.map((h, i) => ({
    id: `${h.source}:${h.method}:${h.route}`,
    label: `${h.method} ${h.route}`,
    url: h.route,
    snippet: `${h.source} route: ${h.method} ${h.route}`,
  }));

  // Route hits carry no traversal depth; escalate only on breadth.
  const tier = decideModelTier({
    seeds: hits.map((_, i) => ({ nodeId: String(i), score: 1 })),
    subgraph: { maxSeedHopDistance: 1, distinctSourceArticles: contextNodes.length },
  });

  const result = answerFromContext({ query, contextNodes, tier });
  return result.toTextStreamResponse();
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Manual verification**

With the dev server running and a `GRAPH_QUERY_API_KEY` set in `.env.local` (or unset, in which case the gate allows through — same as `/api/graph/query` today):

Run: `curl -s -X POST http://localhost:3000/api/rag/dev-ask -H 'content-type: application/json' -H 'authorization: Bearer <key-or-omit-if-unset>' -d '{"query":"What process routes handle item creation?"}'`
Expected: a streamed citation-schema object; citations reference `frontend:`/`backend:` route ids that exist in `lib/rag/graph.ts`, OR `insufficientEvidence: true`.

- [ ] **Step 4: Commit**

```bash
git add app/api/rag/dev-ask/route.ts
git commit -m "feat: add /api/rag/dev-ask developer graph-query RAG route"
```

---

### Task 7: Build the real content knowledge graph over `content/`

**Files:**
- Create: `scripts/build-content-graph.ts`
- Modify (regenerate, replacing fixture): `lib/rag/content-graph/graph.json`, `lib/rag/content-graph/embeddings.json`

**Interfaces:**
- Consumes: a graphify graph over `content/` (see Step 1). Produces the real committed runtime artifacts in the shape from Global Constraints.

This task has a genuine offline/LLM-extraction dependency (graphify over MDX is LLM-driven). It is deliberately LAST so Tasks 1–6 ship a fully working, fixture-tested engine regardless of this step's cost/latency.

- [ ] **Step 1: Build the graphify graph over `content/`**

Run graphify's content-extraction over the docs corpus, producing a `graph.json` in graphify's node-link format (`{ nodes: [{id,label,source_file,community,...}], links: [{source,target,relation,...}] }`). Invoke via the `/graphify` skill against `content/` (its doc extractor is LLM-driven — Gemini if `GEMINI_API_KEY` is set, else host-subagent dispatch). Record where it writes `graphify-out/graph.json`.

If graphify's MDX extraction proves too thin to be useful (e.g. only file-level nodes with no concept edges), STOP and report — do not fabricate a graph. That is a real finding that changes the approach, not something to paper over.

- [ ] **Step 2: Write the transform+embed build script**

Create `scripts/build-content-graph.ts` that:
1. Reads graphify's `graph.json` (path as a CLI arg).
2. Transforms each graphify node into the runtime `GraphNode` shape: `id` from graphify `id`; `label` from `label`; `url` derived from `source_file` the same way `lib/rag/help.ts`'s `deriveUrl` does (strip `content/` prefix + `.mdx`, prepend `/docs`); `snippet` = a short excerpt of that article's text (read the source file, strip MDX like `lib/rag/help.ts`'s `stripMdx`, take the first ~300 chars); `community` from graphify `community`.
3. Transforms graphify `links` into `edges` (`source`, `target`, `relation`).
4. Embeds each node's `label + snippet` via `embedMany` (`text-embedding-3-small`), batching if needed (embedMany handles batching, but guard the total node count and log it).
5. Writes the runtime `graph.json` and `embeddings.json` to `lib/rag/content-graph/`, replacing the fixtures.

Reuse the `deriveUrl`/`stripMdx` logic pattern from `lib/rag/help.ts` (copy the small pure functions; do not import from help.ts to avoid coupling the build script to its internals).

- [ ] **Step 3: Run the build and validate**

Run: `npx tsx scripts/build-content-graph.ts <path-to-graphify-graph.json>`
Expected: writes both files; logs node/edge/embedding counts. Validate:
- `npx tsx -e "const g=require('./lib/rag/content-graph/graph.json'); console.log('nodes',g.nodes.length,'edges',g.edges.length); console.log('all nodes have url+snippet', g.nodes.every(n=>n.url&&n.snippet))"` → all-true, counts plausible for 586 articles.
- `npx tsx -e "const e=require('./lib/rag/content-graph/embeddings.json'); console.log('dim',e.dim,'vectors',Object.keys(e.vectors).length)"` → dim 1536, vector count == node count.

- [ ] **Step 4: Re-run the manual route checks against the real graph**

Repeat Task 5 Step 3's two curls. Now the answer to "What is Kissflow?" should cite real content nodes, and the sources should span real doc URLs.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-content-graph.ts lib/rag/content-graph/graph.json lib/rag/content-graph/embeddings.json
git commit -m "feat: build real content knowledge graph over docs corpus"
```

---

### Task 8: Final integration verification

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

Run: `npx tsx --test lib/rag/escalation.test.ts lib/rag/content-graph.test.ts`
Expected: all pass.

- [ ] **Step 2: Type check**

Run: `npm run types:check`
Expected: exit 0.

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: exit 0; `/api/rag/ask` and `/api/rag/dev-ask` appear in the route list as dynamic (`ƒ`) routes.

- [ ] **Step 4: End-to-end manual walkthrough**

Dev server up. Confirm, against the REAL content graph:
1. `/api/rag/ask` with a real product question → grounded answer citing real doc node ids, sources resolve to real `/docs/...` URLs.
2. `/api/rag/ask` with an out-of-scope question → `insufficientEvidence: true`.
3. `/api/rag/dev-ask` with a developer question (+ API key if set) → answer citing real route ids from `lib/rag/graph.ts`.
4. Confirm `/api/chat`, `AIChat`, and the floating launcher are byte-for-byte unchanged (`git diff` shows no changes to those paths across the whole branch).

- [ ] **Step 5: Push / PR only if explicitly requested** — do not push automatically.
