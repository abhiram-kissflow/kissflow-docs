import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupSources,
  rankSections,
  seedSearch,
  constrainSubgraph,
  type ContentGraph,
  type GraphNode,
} from './content-graph';

const graph: ContentGraph = {
  nodes: [
    { id: 'n1', label: 'A', url: '/docs/a', articleUrl: '/docs/a', heading: 'A', anchor: '', snippet: 'a', media: [], community: 0 },
    { id: 'n2', label: 'B', url: '/docs/b', articleUrl: '/docs/b', heading: 'B', anchor: '', snippet: 'b', media: [], community: 0 },
    { id: 'n3', label: 'C', url: '/docs/c', articleUrl: '/docs/c', heading: 'C', anchor: '', snippet: 'c', media: [], community: 1 },
    { id: 'n4', label: 'D', url: '/docs/d', articleUrl: '/docs/d', heading: 'D', anchor: '', snippet: 'd', media: [], community: 1 },
  ],
  edges: [
    { source: 'n1', target: 'n2', relation: 'related' },
    { source: 'n2', target: 'n3', relation: 'related' },
    { source: 'n3', target: 'n4', relation: 'related' },
  ],
};

const childTables: GraphNode = {
  id: '/docs/form#child-tables',
  label: 'Creating a form',
  url: '/docs/form#child-tables',
  articleUrl: '/docs/form',
  heading: 'Child tables',
  anchor: 'child-tables',
  snippet: 'Click Add table to create a child table.',
  media: [],
  community: 0,
};

const csv: GraphNode = {
  id: '/docs/form#csv',
  label: 'Creating a form',
  url: '/docs/form#csv',
  articleUrl: '/docs/form',
  heading: 'CSV import',
  anchor: 'csv',
  snippet: 'Import rows from a CSV file.',
  media: [],
  community: 0,
};

test('rankSections returns the answer-bearing child-table section first', () => {
  const sectionGraph: ContentGraph = { nodes: [childTables, csv], edges: [] };
  const sectionVectors = {
    [childTables.id]: [1, 0],
    [csv.id]: [0, 1],
  };

  const hits = rankSections([1, 0], 1, sectionGraph, sectionVectors);
  assert.deepEqual(hits.map((hit) => hit.nodeId), ['/docs/form#child-tables']);
});

test('groupSources emits one article source for multiple cited sections', () => {
  assert.deepEqual(groupSources([childTables, csv]), [
    { title: 'Creating a form', url: '/docs/form' },
  ]);
});

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
