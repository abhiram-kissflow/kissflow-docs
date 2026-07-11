import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('brand variants use centered logo and a compact Docs label in documentation sidebar', async () => {
  const source = await readFile(new URL('../lib/layout.shared.tsx', import.meta.url), 'utf8');
  const docsLayout = await readFile(new URL('../app/docs/layout.tsx', import.meta.url), 'utf8');

  assert.match(source, /className="flex items-center gap-2"/);
  assert.doesNotMatch(source, /items-baseline/);
  assert.match(source, /relative translate-y-px leading-none/);
  assert.match(source, /compact \? 'Docs' : 'Documentation'/);
  assert.match(source, /compact \? 'h-4 w-auto' : 'h-4 w-auto'/);
  assert.match(docsLayout, /\.\.\.baseOptions\('docs'\)/);
});
