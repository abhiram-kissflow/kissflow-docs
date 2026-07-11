import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('documentation sections use a persistent sidebar dropdown', async () => {
  const source = await readFile(new URL('../app/docs/layout.tsx', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../components/persistent-docs-tab-menu.tsx', import.meta.url), 'utf8');

  assert.match(source, /tabs=\{false\}/);
  assert.match(source, /sidebar=\{\{ banner: <PersistentDocsTabMenu \/> \}\}/);
  assert.match(menu, /useState\(true\)/);
  assert.doesNotMatch(menu, /setOpen\(false\)/);
});
