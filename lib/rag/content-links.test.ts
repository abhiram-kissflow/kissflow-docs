import assert from 'node:assert/strict';
import test from 'node:test';
import { findContentLinkEdges } from './content-links';

test('keeps a markdown source link after an article is split into sections', () => {
  const edges = findContentLinkEdges(
    [
      { id: '/docs/forms#child-tables', url: '/docs/forms#child-tables', articleUrl: '/docs/forms' },
      { id: '/docs/forms#csv', url: '/docs/forms#csv', articleUrl: '/docs/forms' },
      { id: '/docs/fields#text', url: '/docs/fields#text', articleUrl: '/docs/fields' },
    ],
    [{ articleUrl: '/docs/forms', body: 'See [text fields](/docs/fields).' }],
  );

  assert.deepEqual(edges, [
    { source: '/docs/forms#child-tables', target: '/docs/fields#text', relation: 'links-to' },
  ]);
});

test('uses an H2-only article as a deterministic link source', () => {
  const edges = findContentLinkEdges(
    [
      { id: '/docs/forms#child-tables', url: '/docs/forms#child-tables', articleUrl: '/docs/forms' },
      { id: '/docs/fields#text', url: '/docs/fields#text', articleUrl: '/docs/fields' },
    ],
    [{ articleUrl: '/docs/forms', body: '## Child tables\nSee [text fields](/docs/fields).' }],
  );

  assert.deepEqual(edges, [
    { source: '/docs/forms#child-tables', target: '/docs/fields#text', relation: 'links-to' },
  ]);
});
