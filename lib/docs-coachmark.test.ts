import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowDocsCoachmark } from './docs-coachmark';

test('shows the coachmark only when this session has not dismissed it', () => {
  assert.equal(shouldShowDocsCoachmark(null), true);
  assert.equal(shouldShowDocsCoachmark('dismissed'), false);
});

test('treats unexpected storage values as not dismissed', () => {
  assert.equal(shouldShowDocsCoachmark('unexpected'), true);
});
