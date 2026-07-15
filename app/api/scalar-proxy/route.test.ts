import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedTarget } from './target';

test('isAllowedTarget: allows kissflow.com subdomains over https/http', () => {
  assert.equal(isAllowedTarget('https://acme.kissflow.com/api/v1/foo'), true);
  assert.equal(isAllowedTarget('https://kissflow.com/health'), true);
  assert.equal(isAllowedTarget('http://staging.kissflow.com/x'), true);
});

test('isAllowedTarget: blocks look-alike and unrelated hosts (SSRF guard)', () => {
  assert.equal(isAllowedTarget('https://evilkissflow.com/x'), false); // no dot boundary
  assert.equal(isAllowedTarget('https://kissflow.com.evil.com/x'), false);
  assert.equal(isAllowedTarget('https://example.com/x'), false);
  assert.equal(isAllowedTarget('http://169.254.169.254/latest/meta-data'), false); // metadata IP
  assert.equal(isAllowedTarget('http://localhost:1337/x'), false);
});

test('isAllowedTarget: rejects missing/relative/non-http targets', () => {
  assert.equal(isAllowedTarget(null), false);
  assert.equal(isAllowedTarget('/relative/path'), false);
  assert.equal(isAllowedTarget('file:///etc/passwd'), false);
  assert.equal(isAllowedTarget('ftp://acme.kissflow.com/x'), false);
});
