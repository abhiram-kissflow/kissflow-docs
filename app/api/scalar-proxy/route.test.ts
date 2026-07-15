import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedTarget, isStrippedRequestHeader } from './target';

test('isStrippedRequestHeader: drops x-forwarded-host (Kissflow DomainMissMatch cause)', () => {
  // Regression guard: Vercel injects X-Forwarded-Host = docs host; Kissflow
  // reads it as the account domain, so forwarding it 403s DomainMissMatchError.
  assert.equal(isStrippedRequestHeader('x-forwarded-host'), true);
  assert.equal(isStrippedRequestHeader('X-Forwarded-Host'), true);
  assert.equal(isStrippedRequestHeader('x-forwarded-for'), true);
  assert.equal(isStrippedRequestHeader('x-vercel-id'), true);
  assert.equal(isStrippedRequestHeader('forwarded'), true);
  assert.equal(isStrippedRequestHeader('host'), true);
  assert.equal(isStrippedRequestHeader('origin'), true);
});

test('isStrippedRequestHeader: forwards auth + content headers', () => {
  assert.equal(isStrippedRequestHeader('X-Access-Key-Id'), false);
  assert.equal(isStrippedRequestHeader('X-Access-Key-Secret'), false);
  assert.equal(isStrippedRequestHeader('accept'), false);
  assert.equal(isStrippedRequestHeader('content-type'), false);
  assert.equal(isStrippedRequestHeader('user-agent'), false);
});

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
