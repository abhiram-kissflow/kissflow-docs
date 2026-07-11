import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('documentation sections stay visible as top navigation on desktop', async () => {
  const source = await readFile(new URL('../app/docs/layout.tsx', import.meta.url), 'utf8');

  assert.match(source, /<DocsLayout\s+tabMode="top"/);
  assert.match(source, /tabs=\{\[/);
});
