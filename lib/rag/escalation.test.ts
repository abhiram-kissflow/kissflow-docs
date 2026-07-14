import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideModelTier } from './escalation';

test('stays on luna for a confident, dominant seed', () => {
  const seeds = [
    { nodeId: 'a', score: 0.82 },
    { nodeId: 'b', score: 0.55 },
  ];
  assert.equal(decideModelTier({ seeds }), 'luna');
});

test('escalates to terra on weak evidence (top seed below ceiling)', () => {
  const seeds = [
    { nodeId: 'a', score: 0.57 },
    { nodeId: 'b', score: 0.54 },
  ];
  assert.equal(decideModelTier({ seeds }), 'terra');
});

test('escalates to terra on ambiguous seeds (top scores clustered)', () => {
  const seeds = [
    { nodeId: 'a', score: 0.8 },
    { nodeId: 'b', score: 0.78 },
  ];
  assert.equal(decideModelTier({ seeds }), 'terra');
});

test('a clear gap between strong seeds is not ambiguity', () => {
  const seeds = [
    { nodeId: 'a', score: 0.78 },
    { nodeId: 'b', score: 0.7 },
  ];
  assert.equal(decideModelTier({ seeds }), 'luna');
});

test('escalates when there are no seeds at all', () => {
  assert.equal(decideModelTier({ seeds: [] }), 'terra');
});

test('handles a single strong seed without throwing', () => {
  assert.equal(decideModelTier({ seeds: [{ nodeId: 'a', score: 0.9 }] }), 'luna');
});
