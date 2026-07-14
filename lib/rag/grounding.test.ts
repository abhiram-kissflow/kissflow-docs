import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateGroundedAnswer } from './grounding';
import type { ContextNode } from './answer';

const childSection: ContextNode = {
  id: 'child',
  label: 'Creating a form',
  url: '/docs/build/forms/creating-a-form#child-tables',
  snippet: 'Click Add table to create a child table.',
  media: [
    {
      id: 'child-media-1',
      kind: 'image',
      url: '/migration-assets/add-table.png',
      alt: 'Add table button',
    },
  ],
};

const secondSectionWithSharedMedia: ContextNode = {
  id: 'csv',
  label: 'Creating a form',
  url: '/docs/build/forms/creating-a-form#csv',
  snippet: 'Import rows from a CSV file.',
  media: [
    {
      id: 'csv-media-1',
      kind: 'image',
      url: '/migration-assets/add-table.png',
      alt: 'The same source asset',
    },
  ],
};

test('abstains when a non-empty answer has no valid citation', () => {
  const result = validateGroundedAnswer(
    {
      answer: 'Use Add table.',
      citations: [{ nodeId: 'missing', snippet: 'x' }],
      media: [],
      insufficientEvidence: false,
    },
    [childSection],
  );

  assert.deepEqual(result, {
    answer: '',
    citations: [],
    media: [],
    insufficientEvidence: true,
  });
});

test('drops a citation whose claimed snippet is not present in its source section', () => {
  const result = validateGroundedAnswer(
    {
      answer: 'Use Add table.',
      citations: [{ nodeId: 'child', snippet: 'Use an invisible button.' }],
      media: [],
      insufficientEvidence: false,
    },
    [childSection],
  );

  assert.equal(result.insufficientEvidence, true);
});

test('rejects whitespace-only and non-substantive citation snippets', () => {
  for (const snippet of ['   ', 'Click']) {
    const result = validateGroundedAnswer(
      {
        answer: 'Use Add table.',
        citations: [{ nodeId: 'child', snippet }],
        media: [],
        insufficientEvidence: false,
      },
      [childSection],
    );

    assert.equal(result.insufficientEvidence, true, `expected ${JSON.stringify(snippet)} to be rejected`);
  }
});

test('retains source media only when it belongs to a cited section', () => {
  const result = validateGroundedAnswer(
    {
      answer: 'Use Add table.',
      citations: [
        { nodeId: 'child', snippet: 'Click Add table to create a child table.' },
        { nodeId: 'child', snippet: 'Click Add table to create a child table.' },
      ],
      media: [
        { nodeId: 'child', mediaId: 'child-media-1' },
        { nodeId: 'child', mediaId: 'child-media-1' },
        { nodeId: 'child', mediaId: 'not-present' },
        { nodeId: 'uncited', mediaId: 'child-media-1' },
      ],
      insufficientEvidence: false,
    },
    [childSection],
  );

  assert.deepEqual(result.citations, [
    { nodeId: 'child', snippet: 'Click Add table to create a child table.' },
  ]);
  assert.deepEqual(result.media, [{ nodeId: 'child', mediaId: 'child-media-1' }]);
});

test('rejects media from an available but uncited section', () => {
  const result = validateGroundedAnswer(
    {
      answer: 'Use Add table.',
      citations: [{ nodeId: 'child', snippet: 'Click Add table to create a child table.' }],
      media: [{ nodeId: 'csv', mediaId: 'csv-media-1' }],
      insufficientEvidence: false,
    },
    [childSection, secondSectionWithSharedMedia],
  );

  assert.deepEqual(result.media, []);
});

test('deduplicates the same source asset selected from multiple cited sections', () => {
  const result = validateGroundedAnswer(
    {
      answer: 'Create a child table, then import rows.',
      citations: [
        { nodeId: 'child', snippet: 'Click Add table to create a child table.' },
        { nodeId: 'csv', snippet: 'Import rows from a CSV file.' },
      ],
      media: [
        { nodeId: 'child', mediaId: 'child-media-1' },
        { nodeId: 'csv', mediaId: 'csv-media-1' },
      ],
      insufficientEvidence: false,
    },
    [childSection, secondSectionWithSharedMedia],
  );

  assert.deepEqual(result.media, [{ nodeId: 'child', mediaId: 'child-media-1' }]);
});

test('treats an empty answer as an abstention even when the model did not flag it', () => {
  const result = validateGroundedAnswer(
    {
      answer: '',
      citations: [{ nodeId: 'child', snippet: 'Click Add table to create a child table.' }],
      media: [{ nodeId: 'child', mediaId: 'child-media-1' }],
      insufficientEvidence: false,
    },
    [childSection],
  );

  assert.deepEqual(result, {
    answer: '',
    citations: [],
    media: [],
    insufficientEvidence: true,
  });
});

test('treats a model-declared evidence gap as an abstention even with answer content', () => {
  const result = validateGroundedAnswer(
    {
      answer: 'Unsupported answer.',
      citations: [{ nodeId: 'child', snippet: 'Click Add table to create a child table.' }],
      media: [{ nodeId: 'child', mediaId: 'child-media-1' }],
      insufficientEvidence: true,
    },
    [childSection],
  );

  assert.deepEqual(result, {
    answer: '',
    citations: [],
    media: [],
    insufficientEvidence: true,
  });
});
