import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuth } from './normalize-openapi-auth';

test('strips the two access-key headers and adds a combined security requirement', () => {
  const input = {
    paths: {
      '/user/2/{account_id}/{user_id}': {
        get: {
          parameters: [
            { name: 'X-Access-Key-Id', in: 'header' },
            { name: 'X-Access-Key-Secret', in: 'header' },
            { name: 'account_id', in: 'path' },
          ],
        },
      },
    },
  };

  const result = normalizeAuth(input as any);
  const op = (result.paths['/user/2/{account_id}/{user_id}'] as any).get;

  assert.deepEqual(op.parameters, [{ name: 'account_id', in: 'path' }]);
  assert.deepEqual(op.security, [{ accessKeyId: [], accessKeySecret: [] }]);
  assert.deepEqual(result.components?.securitySchemes?.accessKeyId, {
    type: 'apiKey',
    in: 'header',
    name: 'X-Access-Key-Id',
  });
  assert.deepEqual(result.components?.securitySchemes?.accessKeySecret, {
    type: 'apiKey',
    in: 'header',
    name: 'X-Access-Key-Secret',
  });
});

test('leaves path-level keys other than HTTP methods untouched', () => {
  const input = {
    paths: {
      '/foo': {
        parameters: [{ name: 'shared', in: 'query' }],
        get: { parameters: [] },
      },
    },
  };

  const result = normalizeAuth(input as any);
  assert.deepEqual((result.paths['/foo'] as any).parameters, [{ name: 'shared', in: 'query' }]);
});
