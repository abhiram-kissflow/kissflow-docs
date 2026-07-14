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
