import assert from 'node:assert/strict';
import test from 'node:test';
import { mediaForDisplay, toEmbeddableVideoUrl } from './rag-media';

test('maps only validated selected source media into public display data', () => {
  const media = mediaForDisplay(
    [
      { nodeId: 'child-tables', mediaId: 'screenshot' },
      { nodeId: 'child-tables', mediaId: 'walkthrough' },
    ],
    [
      {
        id: 'child-tables',
        label: 'Child tables',
        url: '/docs/forms#child-tables',
        snippet: 'Click Add table.',
        media: [
          { id: 'screenshot', kind: 'image', url: '/assets/add-table.png', alt: 'Add table button' },
          { id: 'walkthrough', kind: 'video', url: 'https://www.youtube.com/watch?v=abc123', alt: 'Walkthrough' },
          { id: 'unselected', kind: 'image', url: '/assets/unselected.png', alt: 'Unselected' },
        ],
      },
    ],
  );

  assert.deepEqual(media, [
    {
      id: 'child-tables:screenshot',
      kind: 'image',
      url: '/assets/add-table.png',
      alt: 'Add table button',
      title: 'Child tables',
      sourceUrl: '/docs/forms#child-tables',
    },
    {
      id: 'child-tables:walkthrough',
      kind: 'video',
      url: 'https://www.youtube.com/watch?v=abc123',
      alt: 'Walkthrough',
      title: 'Child tables',
      sourceUrl: '/docs/forms#child-tables',
    },
  ]);
});

test('creates embeds only for allowlisted YouTube and Vimeo URLs', () => {
  assert.equal(toEmbeddableVideoUrl('https://youtu.be/abc123?t=12'), 'https://www.youtube.com/embed/abc123');
  assert.equal(toEmbeddableVideoUrl('https://www.youtube.com/watch?v=abc123&feature=share'), 'https://www.youtube.com/embed/abc123');
  assert.equal(toEmbeddableVideoUrl('https://vimeo.com/123456'), 'https://player.vimeo.com/video/123456');
  assert.equal(toEmbeddableVideoUrl('https://example.com/video/123'), null);
  assert.equal(toEmbeddableVideoUrl('javascript:alert(1)'), null);
});
