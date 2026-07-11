import assert from 'node:assert/strict';
import test from 'node:test';
import { siteMetadata } from './site-metadata';

test('uses the Kissflow Documentation title in browser tabs', () => {
  assert.equal(siteMetadata.title, 'Kissflow Documentation');
});
