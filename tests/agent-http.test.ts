import { describe, expect, it } from 'vitest';
import { corsHeaders, isAllowedOrigin, validateChatRequest } from '../agent-worker/src/http';

const ALLOWED = 'https://abhiram-kissflow.github.io,http://localhost:3000';

describe('isAllowedOrigin', () => {
  it('accepts listed origins, rejects others and null', () => {
    expect(isAllowedOrigin('https://abhiram-kissflow.github.io', ALLOWED)).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000', ALLOWED)).toBe(true);
    expect(isAllowedOrigin('https://evil.example', ALLOWED)).toBe(false);
    expect(isAllowedOrigin(null, ALLOWED)).toBe(false);
  });
});

describe('corsHeaders', () => {
  it('echoes the allowed origin', () => {
    const h = corsHeaders('http://localhost:3000');
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(h['Access-Control-Allow-Methods']).toContain('POST');
  });
});

describe('validateChatRequest', () => {
  it('accepts a valid history', () => {
    const result = validateChatRequest({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'how do decision tables work?' },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects non-object, missing messages, bad roles, oversized input', () => {
    expect(validateChatRequest(null).ok).toBe(false);
    expect(validateChatRequest({}).ok).toBe(false);
    expect(validateChatRequest({ messages: [{ role: 'system', content: 'x' }] }).ok).toBe(false);
    expect(
      validateChatRequest({ messages: [{ role: 'user', content: 'x'.repeat(5000) }] }).ok,
    ).toBe(false);
    const tooMany = Array.from({ length: 25 }, () => ({ role: 'user' as const, content: 'q' }));
    expect(validateChatRequest({ messages: tooMany }).ok).toBe(false);
  });
});
