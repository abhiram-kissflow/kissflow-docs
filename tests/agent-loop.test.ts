import { describe, expect, it } from 'vitest';
import { runAgent, type ModelResponse } from '../agent-worker/src/agent';
import { buildSearch } from '../agent-worker/src/search';

const search = buildSearch({
  pages: [{ url: '/docs/dt/eval', title: 'Evaluation settings', text: 'First row wins on ties.' }],
  chunks: [
    {
      id: '/docs/dt/eval#0',
      url: '/docs/dt/eval',
      title: 'Evaluation settings',
      heading: 'Ties',
      text: 'First row wins on ties.',
    },
  ],
});

function modelScript(responses: ModelResponse[]) {
  let i = 0;
  return async () => responses[i++];
}

describe('runAgent', () => {
  it('runs search -> read -> answer and emits status, tokens, sources, done', async () => {
    const events: unknown[] = [];
    await runAgent({
      messages: [{ role: 'user', content: 'How are ties handled?' }],
      search,
      emit: (e) => void events.push(e),
      callModel: modelScript([
        {
          toolCalls: [
            { id: 'c1', name: 'search_docs', arguments: '{"query":"ties"}' },
          ],
        },
        {
          toolCalls: [
            { id: 'c2', name: 'read_page', arguments: '{"url":"/docs/dt/eval"}' },
          ],
        },
        { content: 'First row wins. See [Evaluation settings](/docs/dt/eval).' },
      ]),
    });

    const types = events.map((e: any) => e.type);
    expect(types.filter((t) => t === 'status').length).toBe(2);
    expect(types).toContain('token');
    const sources = events.find((e: any) => e.type === 'sources') as any;
    expect(sources.sources).toEqual([{ url: '/docs/dt/eval', title: 'Evaluation settings' }]);
    expect(types[types.length - 1]).toBe('done');
  });

  it('forces an answer after max rounds', async () => {
    const events: unknown[] = [];
    const loopForever: ModelResponse = {
      toolCalls: [{ id: 'x', name: 'search_docs', arguments: '{"query":"q"}' }],
    };
    await runAgent({
      messages: [{ role: 'user', content: 'q' }],
      search,
      emit: (e) => void events.push(e),
      callModel: modelScript([
        loopForever,
        loopForever,
        loopForever,
        loopForever,
        loopForever,
        { content: 'Best effort answer.' },
      ]),
    });
    expect((events as any[]).some((e) => e.type === 'token')).toBe(true);
    expect((events as any[]).at(-1)).toEqual({ type: 'done' });
  });

  it('emits error event when the model call throws', async () => {
    const events: unknown[] = [];
    await runAgent({
      messages: [{ role: 'user', content: 'q' }],
      search,
      emit: (e) => void events.push(e),
      callModel: async () => {
        throw new Error('upstream down');
      },
    });
    expect((events as any[]).at(-1).type).toBe('error');
  });
});
