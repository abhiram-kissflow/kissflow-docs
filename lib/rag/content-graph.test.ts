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

test('constrainSubgraph does not return edges to nodes dropped by maxNodes', () => {
  const result = constrainSubgraph(['n1'], { maxNodes: 2, maxHops: 5 }, graph);
  const ids = new Set(result.nodes.map((n) => n.id));
  assert.ok(result.edges.every((e) => ids.has(e.source) && ids.has(e.target)));
});
