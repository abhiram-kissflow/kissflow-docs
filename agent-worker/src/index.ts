import { runAgent, type AgentEvent } from './agent';
import { corsHeaders, isAllowedOrigin, validateChatRequest } from './http';
import { makeOpenAICaller } from './openai';
import { buildSearch, type ChunksFile, type SearchApi } from './search';

// Minimal hand-rolled bindings — intentionally not @cloudflare/workers-types,
// so the root `tsc --noEmit` stays clean without tsconfig changes.
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  OPENAI_API_KEY: string;
  MODEL: string;
  ALLOWED_ORIGINS: string;
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

let searchPromise: Promise<SearchApi> | null = null;

function getSearch(env: Env): Promise<SearchApi> {
  searchPromise ??= env.ASSETS.fetch(new Request('https://assets.local/chunks.json'))
    .then((r) => r.json() as Promise<ChunksFile>)
    .then(buildSearch);
  return searchPromise;
}

function sse(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (url.pathname !== '/chat') return new Response('Not found', { status: 404 });

    if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
      return new Response('Forbidden', { status: 403 });
    }
    const cors = corsHeaders(origin!);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response('Rate limited', { status: 429, headers: cors });
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: cors });
    }
    const validated = validateChatRequest(body);
    if (!validated.ok) {
      return new Response(validated.error, { status: 400, headers: cors });
    }

    const search = await getSearch(env);
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    ctx.waitUntil(
      runAgent({
        messages: validated.messages,
        search,
        emit: (event) => void writer.write(encoder.encode(sse(event))),
        callModel: makeOpenAICaller(env.OPENAI_API_KEY, env.MODEL),
      }).finally(() => writer.close()),
    );

    return new Response(readable, {
      headers: {
        ...cors,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
      },
    });
  },
};
