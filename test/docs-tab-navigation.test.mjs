import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('documentation sections use a persistent sidebar dropdown', async () => {
  const source = await readFile(new URL('../app/docs/layout.tsx', import.meta.url), 'utf8');
  const menu = await readFile(new URL('../components/persistent-docs-tab-menu.tsx', import.meta.url), 'utf8');

  assert.match(source, /tabs=\{false\}/);
  assert.match(source, /className="bg-fd-background text-fd-foreground"/);
  assert.match(source, /sidebar=\{\{ banner: <PersistentDocsTabMenu \/> \}\}/);
  assert.match(menu, /useState\(false\)/);
  assert.match(menu, /tabs\.filter\(\(tab\) => tab\.href !== selected\.href\)/);
  assert.match(menu, /title: 'API Reference'[\s\S]*external: true/);
  assert.match(menu, /target="_blank" rel="noopener noreferrer"/);
});
