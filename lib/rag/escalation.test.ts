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
