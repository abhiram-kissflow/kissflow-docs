import { describe, expect, it } from 'vitest';
import { chunkPage, deriveUrl, stripMdx } from '../scripts/lib/agent-index';

describe('deriveUrl', () => {
  it('maps a regular file to /docs path', () => {
    expect(deriveUrl('build/decision-tables/overview.mdx')).toBe(
      '/docs/build/decision-tables/overview',
    );
  });
  it('maps index files to their directory', () => {
    expect(deriveUrl('build/index.mdx')).toBe('/docs/build');
    expect(deriveUrl('index.mdx')).toBe('/docs');
  });
  it('handles .md extension', () => {
    expect(deriveUrl('build/intro.md')).toBe('/docs/build/intro');
  });
});

describe('stripMdx', () => {
  it('removes imports, exports and JSX tags but keeps text', () => {
    const input = [
      "import { Callout } from 'fumadocs-ui/components/callout';",
      '',
      '<Callout type="info">Tables evaluate top-down.</Callout>',
      '',
      'Plain paragraph stays.',
    ].join('\n');
    const out = stripMdx(input);
    expect(out).not.toContain('import ');
    expect(out).not.toContain('<Callout');
    expect(out).toContain('Tables evaluate top-down.');
    expect(out).toContain('Plain paragraph stays.');
  });
});

describe('chunkPage', () => {
  it('splits content on ## headings, first chunk is intro', () => {
    const body = [
      'Intro text.',
      '',
      '## Evaluation order',
      'Rules run top-down.',
      '',
      '## Tie breaking',
      'First match wins.',
    ].join('\n');
    const chunks = chunkPage({ url: '/docs/dt', title: 'Decision tables', body });
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ id: '/docs/dt#0', heading: '', url: '/docs/dt' });
    expect(chunks[1].heading).toBe('Evaluation order');
    expect(chunks[1].text).toContain('top-down');
    expect(chunks[2].heading).toBe('Tie breaking');
  });
});
