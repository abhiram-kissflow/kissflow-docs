import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { discoverEnglishContentFiles } from './content-discovery';

test('discovers English MD and MDX content while excluding localized variants', () => {
  const contentRoot = path.join(process.cwd(), 'content');
  const files = discoverEnglishContentFiles(contentRoot)
    .map((file) => path.relative(contentRoot, file).split(path.sep).join('/'));

  assert.ok(files.includes('build/forms/creating-a-form.mdx'));
  assert.ok(files.every((file) => /\.mdx?$/.test(file)));
  assert.ok(files.every((file) => !/\.[a-z]{2,3}\.mdx?$/.test(file)));
});
