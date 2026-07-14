import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateGroundedAnswer } from './grounding';
import type { ContextNode } from './answer';

const childSection: ContextNode = {
  id: 'child',
  label: 'Creating a form',
  url: '/docs/build/forms/creating-a-form#child-tables',
  snippet: 'Click Add table to create a child table.',
  media: [{ id: 'child-media-1', kind: 'image', url: '/migration-assets/add-table.png?cache=1#top', alt: 'Add table button' }],
};

const csvSection: ContextNode = {
  id: 'csv',
  label: 'Creating a form',
  url: '/docs/build/forms/creating-a-form#csv',
  snippet: 'Import rows from a CSV file.',
  media: [{ id: 'csv-media-1', kind: 'image', url: '/migration-assets/add-table.png?cache=2', alt: 'The same source asset' }],
};

const emptyUrlSection: ContextNode = {
  id: 'empty-media',
  label: 'Broken media',
  url: '/docs/broken-media',
  snippet: 'Broken media must not render.',
  media: [
    { id: 'empty-media-hash', kind: 'image', url: '   ', alt: 'Broken', assetHash: 'sha256:broken' },
    { id: 'empty-media-key', kind: 'image', url: '', alt: 'Also broken', dedupeKey: 'gcs:broken' },
  ],
};

const limitSection: ContextNode = {
  id: 'limit',
  label: 'Limits',
  url: '/docs/limits',
  snippet: 'The limit is 100.',
  media: [],
};

function groundedAnswer(overrides: Record<string, unknown> = {}) {
  return {
    answer: 'Use Add table.',
    claims: [{ markdown: 'Use Add table.', citationIds: ['child-citation'] }],
    citations: [{ id: 'child-citation', nodeId: 'child', snippet: 'Click Add table to create a child table.' }],
    media: [],
    insufficientEvidence: false,
    ...overrides,
  };
}

const abstention = { answer: '', claims: [], citations: [], media: [], insufficientEvidence: true };

test('abstains when a non-empty answer has no valid citation', () => {
  const result = validateGroundedAnswer(
    groundedAnswer({ citations: [{ id: 'missing', nodeId: 'missing', snippet: 'x' }] }),
    [childSection],
  );
  assert.deepEqual(result, abstention);
});

test('accepts a short exact citation when it is explicitly bound to the rendered claim', () => {
  const result = validateGroundedAnswer(
    groundedAnswer({
      answer: '100',
      claims: [{ markdown: '100', citationIds: ['limit'] }],
      citations: [{ id: 'limit', nodeId: 'limit', snippet: '100' }],
    }),
    [limitSection],
  );

  assert.equal(result.insufficientEvidence, false);
  assert.deepEqual(result.citations, [{ id: 'limit', nodeId: 'limit', snippet: '100' }]);
});

test('rejects whitespace-only evidence', () => {
  const result = validateGroundedAnswer(
    groundedAnswer({ citations: [{ id: 'blank', nodeId: 'child', snippet: '   ' }] }),
    [childSection],
  );
  assert.deepEqual(result, abstention);
});

test('abstains when an answer contains an unsupported extra block', () => {
  const result = validateGroundedAnswer(
    groundedAnswer({
      answer: 'Use Add table.\n\nKubernetes deployment is supported.',
      claims: [{ markdown: 'Use Add table.', citationIds: ['child-citation'] }],
    }),
    [childSection],
  );
  assert.deepEqual(result, abstention);
});

test('abstains when a rendered claim has no citation binding', () => {
  const result = validateGroundedAnswer(
    groundedAnswer({
      answer: 'Use Add table.\n\nKubernetes deployment is supported.',
      claims: [
        { markdown: 'Use Add table.', citationIds: ['child-citation'] },
        { markdown: 'Kubernetes deployment is supported.', citationIds: [] },
      ],
    }),
    [childSection],
  );
  assert.deepEqual(result, abstention);
});

test('retains source media only when it belongs to a cited section', () => {
  const result = validateGroundedAnswer(
    groundedAnswer({
      media: [
        { nodeId: 'child', mediaId: 'child-media-1' },
        { nodeId: 'child', mediaId: 'child-media-1' },
        { nodeId: 'child', mediaId: 'not-present' },
        { nodeId: 'csv', mediaId: 'csv-media-1' },
      ],
    }),
    [childSection, csvSection],
  );
  assert.deepEqual(result.media, [{ nodeId: 'child', mediaId: 'child-media-1' }]);
});

test('removes unused valid citations and their media', () => {
  const result = validateGroundedAnswer(
    groundedAnswer({
      citations: [
        { id: 'child-citation', nodeId: 'child', snippet: 'Click Add table to create a child table.' },
        { id: 'csv-citation', nodeId: 'csv', snippet: 'Import rows from a CSV file.' },
      ],
      media: [
        { nodeId: 'child', mediaId: 'child-media-1' },
        { nodeId: 'csv', mediaId: 'csv-media-1' },
      ],
    }),
    [childSection, csvSection],
  );

  assert.deepEqual(result.citations, [
    { id: 'child-citation', nodeId: 'child', snippet: 'Click Add table to create a child table.' },
  ]);
  assert.deepEqual(result.media, [{ nodeId: 'child', mediaId: 'child-media-1' }]);
});

test('deduplicates URL variants of the same cited source asset', () => {
  const result = validateGroundedAnswer(
    groundedAnswer({
      answer: 'Use Add table.\n\nImport rows from a CSV file.',
      claims: [
        { markdown: 'Use Add table.', citationIds: ['child-citation'] },
        { markdown: 'Import rows from a CSV file.', citationIds: ['csv-citation'] },
      ],
      citations: [
        { id: 'child-citation', nodeId: 'child', snippet: 'Click Add table to create a child table.' },
        { id: 'csv-citation', nodeId: 'csv', snippet: 'Import rows from a CSV file.' },
      ],
      media: [
        { nodeId: 'child', mediaId: 'child-media-1' },
        { nodeId: 'csv', mediaId: 'csv-media-1' },
      ],
    }),
    [childSection, csvSection],
  );
  assert.deepEqual(result.media, [{ nodeId: 'child', mediaId: 'child-media-1' }]);
});

test('rejects selected media with an empty source URL even when it has a stable hash or key', () => {
  const result = validateGroundedAnswer(
    groundedAnswer({
      media: [
        { nodeId: 'empty-media', mediaId: 'empty-media-hash' },
        { nodeId: 'empty-media', mediaId: 'empty-media-key' },
      ],
      citations: [{ id: 'empty-citation', nodeId: 'empty-media', snippet: 'Broken media must not render.' }],
      claims: [{ markdown: 'Use Add table.', citationIds: ['empty-citation'] }],
    }),
    [emptyUrlSection],
  );
  assert.deepEqual(result.media, []);
});

test('treats a model-declared evidence gap as an abstention even with answer content', () => {
  const result = validateGroundedAnswer(groundedAnswer({ insufficientEvidence: true }), [childSection]);
  assert.deepEqual(result, abstention);
});
