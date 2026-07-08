import { describe, expect, it } from 'vitest';
import { buildSearch } from '../agent-worker/src/search';

const data = {
  pages: [
    { url: '/docs/dt/eval', title: 'Evaluation settings', text: 'Full eval page text.' },
    { url: '/docs/dt/import', title: 'Importing from CSV', text: 'Full import page text.' },
  ],
  chunks: [
    {
      id: '/docs/dt/eval#0',
      url: '/docs/dt/eval',
      title: 'Evaluation settings',
      heading: 'Tie breaking',
      text: 'When two rules match, the first row wins.',
    },
    {
      id: '/docs/dt/import#0',
      url: '/docs/dt/import',
      title: 'Importing from CSV',
      heading: 'Upload',
      text: 'Upload a CSV file to create rows in bulk.',
    },
  ],
};

describe('buildSearch', () => {
  it('finds relevant chunks by content', () => {
    const api = buildSearch(data);
    const hits = api.search('tie breaking rules match');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].url).toBe('/docs/dt/eval');
    expect(hits[0]).toHaveProperty('snippet');
  });

  it('returns page text by url and null for unknown urls', () => {
    const api = buildSearch(data);
    expect(api.getPage('/docs/dt/import')?.text).toBe('Full import page text.');
    expect(api.getPage('/docs/nope')).toBeNull();
  });

  it('caps page text length', () => {
    const big = { pages: [{ url: '/p', title: 'P', text: 'x'.repeat(20000) }], chunks: [] };
    const api = buildSearch(big);
    expect(api.getPage('/p')!.text.length).toBeLessThanOrEqual(8000);
  });
});
