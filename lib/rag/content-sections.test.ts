import assert from 'node:assert/strict';
import test from 'node:test';

import { extractContentSections } from './content-sections';

test('keeps child-table instructions and their image in one section', () => {
  const chunks = extractContentSections({
    url: '/docs/build/forms/creating-a-form',
    title: 'Creating a form',
    body: 'Intro\n\n## Child tables\nClick **Add table**.\n\n![Add table](/migration-assets/table.png)\n\n## CSV\nImport rows.',
  });

  assert.deepEqual(chunks.map((chunk) => chunk.anchor), ['', 'child-tables', 'csv']);
  assert.match(chunks[1].text, /Add table/);
  assert.doesNotMatch(chunks[1].text, /table\.png/);
  assert.deepEqual(chunks[1].media, [
    { id: 'child-tables-media-1', kind: 'image', url: '/migration-assets/table.png', alt: 'Add table' },
  ]);
});

test('keeps a Vimeo iframe with its owning section', () => {
  const chunks = extractContentSections({
    url: '/docs/a',
    title: 'A',
    body: '## Watch\n<iframe src="https://player.vimeo.com/video/123"></iframe>',
  });

  assert.deepEqual(chunks[0].media, [
    { id: 'watch-media-1', kind: 'video', url: 'https://player.vimeo.com/video/123', alt: '' },
  ]);
  assert.doesNotMatch(chunks[0].text, /vimeo\.com/);
});

test('creates unique anchors and preserves the pre-heading introduction', () => {
  const chunks = extractContentSections({
    url: '/docs/a',
    title: 'A',
    body: 'Overview for this guide.\n\n## Set up!\nFirst step.\n\n## Set up\nSecond step.',
  });

  assert.deepEqual(chunks.map((chunk) => ({ anchor: chunk.anchor, heading: chunk.heading, text: chunk.text })), [
    { anchor: '', heading: 'A', text: 'Overview for this guide.' },
    { anchor: 'set-up', heading: 'Set up!', text: 'First step.' },
    { anchor: 'set-up-2', heading: 'Set up', text: 'Second step.' },
  ]);
});

test('extracts HTML images and supported bare video links without leaving media URLs in text', () => {
  const chunks = extractContentSections({
    url: '/docs/a',
    title: 'A',
    body: [
      "import { Callout } from 'fumadocs-ui/components/callout';",
      '## Demo',
      '<Callout>Remember this.</Callout>',
      '<img src="https://cdn.example.com/demo.png" alt="Demo screen" title="Preview" />',
      'Watch https://www.youtube.com/watch?v=abc123 for the complete walkthrough.',
    ].join('\n\n'),
  });

  assert.equal(chunks[0].text, 'Remember this.\n\nWatch for the complete walkthrough.');
  assert.deepEqual(chunks[0].media, [
    {
      id: 'demo-media-1',
      kind: 'image',
      url: 'https://cdn.example.com/demo.png',
      alt: 'Demo screen',
      title: 'Preview',
    },
    {
      id: 'demo-media-2',
      kind: 'video',
      url: 'https://www.youtube.com/watch?v=abc123',
      alt: '',
    },
  ]);
});
