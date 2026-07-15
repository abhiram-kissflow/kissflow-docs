import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { buildSectionGraph } from '../../scripts/build-content-graph';

test('builds child-table sections directly when no graphify graph is supplied', () => {
  const graph = buildSectionGraph({ contentDir: path.join(process.cwd(), 'content') });
  const childTables = graph.nodes.find((node) => node.id === '/docs/build/forms/creating-a-form#child-tables');

  assert.ok(childTables, 'expected the canonical child-tables section');
  assert.match(childTables.snippet, /Add table/i);
  assert.ok(graph.edges.length > 0, 'expected authored cross-links to be retained');
});
