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

test('uses a canonical anchor for a linked Markdown heading', () => {
  const chunks = extractContentSections({
    url: '/docs/a',
    title: 'A',
    body: '## [Removing filter conditions](/t/123/removing-filter-conditions#removing-filter-conditions)\nRemove a condition.',
  });

  assert.deepEqual(chunks, [
    {
      anchor: 'removing-filter-conditions',
      heading: 'Removing filter conditions',
      text: 'Remove a condition.',
      media: [],
    },
  ]);
});

test('removes inline media without leaving empty punctuation or doubled spaces', () => {
  const chunks = extractContentSections({
    url: '/docs/a',
    title: 'A',
    body: '## Add\nTap **New item** (![New item icon](/assets/new-item.png)) button.\n\nWatch https://youtu.be/abc123 for a demo.',
  });

  assert.equal(chunks[0].text, 'Tap New item button.\n\nWatch for a demo.');
  assert.deepEqual(chunks[0].media.map((item) => item.kind), ['image', 'video']);
});

test('does not treat lookalike hosts as supported video providers', () => {
  const chunks = extractContentSections({
    url: '/docs/a',
    title: 'A',
    body: '## Watch\n<iframe src="https://notyoutube.com/embed/123"></iframe>\nhttps://evilvimeo.com/video/123',
  });

  assert.deepEqual(chunks[0].media, []);
});

test('does not parse headings or media inside fenced code blocks', () => {
  const body = [
    '## Real section',
    'Use this example:',
    '```mdx',
    '## Not a heading',
    '![Not media](/assets/not-media.png)',
    '<iframe src="https://player.vimeo.com/video/123"></iframe>',
    '```',
    'Continue after the example.',
    '## Next section',
    'Done.',
  ].join('\n');
  const chunks = extractContentSections({ url: '/docs/a', title: 'A', body });

  assert.deepEqual(chunks.map((chunk) => chunk.anchor), ['real-section', 'next-section']);
  assert.match(chunks[0].text, /## Not a heading/);
  assert.match(chunks[0].text, /!\[Not media\]\(\/assets\/not-media\.png\)/);
  assert.match(chunks[0].text, /player\.vimeo\.com/);
  assert.deepEqual(chunks[0].media, []);
});
