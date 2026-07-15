import assert from 'node:assert/strict';
import test from 'node:test';

import { batchEmbeddingInputs } from '../../scripts/build-content-graph';

test('batches embedding inputs by count while preserving order', () => {
  const batches = batchEmbeddingInputs(['a', 'b', 'c', 'd', 'e'], {
    maxInputs: 2,
    maxEstimatedTokens: 100,
  });

  assert.deepEqual(batches, [['a', 'b'], ['c', 'd'], ['e']]);
});

test('starts a new batch before its estimated token budget is exceeded', () => {
  const batches = batchEmbeddingInputs(['x'.repeat(200), 'y'.repeat(200), 'z'.repeat(100)], {
    maxInputs: 128,
    maxEstimatedTokens: 75,
  });

  assert.deepEqual(batches, [['x'.repeat(200)], ['y'.repeat(200), 'z'.repeat(100)]]);
});

test('rejects an input that cannot fit in the configured token budget', () => {
  const oversized = 'x'.repeat(1000);
  assert.throws(() => batchEmbeddingInputs([oversized, 'ok'], {
    maxInputs: 128,
    maxEstimatedTokens: 100,
  }), /exceeds the configured embedding token budget/);
});
