import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('hero uses the full Kissflow Documentation name', async () => {
  const source = await readFile(new URL('../components/hero-ask.tsx', import.meta.url), 'utf8');

  assert.match(source, /Ask the Kissflow Documentation/);
});
