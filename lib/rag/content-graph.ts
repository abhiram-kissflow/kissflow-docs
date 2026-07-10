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

  const collectedIds = new Set(collectedNodes.map((n) => n.id));
  const prunedEdges = collectedEdges.filter(
    (e) => collectedIds.has(e.source) && collectedIds.has(e.target),
  );

  const distinctSourceArticles = new Set(collectedNodes.map((n) => n.url)).size;
  return {
    nodes: collectedNodes,
    edges: prunedEdges,
    stats: { maxSeedHopDistance: maxHop, distinctSourceArticles },
  };
}
