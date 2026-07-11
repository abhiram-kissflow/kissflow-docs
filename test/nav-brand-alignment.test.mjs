import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('brand logo and Documentation label use vertical centering', async () => {
  const source = await readFile(new URL('../lib/layout.shared.tsx', import.meta.url), 'utf8');

  assert.match(source, /className="flex items-center gap-2"/);
  assert.doesNotMatch(source, /items-baseline/);
  assert.match(source, />\s*Documentation\s*<\/span>/);
});
