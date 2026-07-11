import { generateObject } from 'ai';
import { z } from 'zod';
import { DEV_QUERY_MODEL } from '@/lib/rag/model-router';
import { searchFrontendGraph, searchBackendGraph, GRAPH_OVERVIEW } from '@/lib/rag/graph';
import { decideModelTier } from '@/lib/rag/escalation';
import { answerFromContext, type ContextNode } from '@/lib/rag/answer';

export const runtime = 'nodejs';

function parseAllowedOrigins(): string[] {
  const raw = process.env.GRAPH_QUERY_ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.length > 0) return allowedOrigins.includes(origin);

  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get('x-forwarded-host');
    const host = forwardedHost || request.headers.get('host') || new URL(request.url).host;
    return originUrl.host === host;
  } catch {
    return false;
  }
}

function hasValidApiKey(request: Request): boolean {
  const expected = process.env.GRAPH_QUERY_API_KEY?.trim();
  if (!expected) return true;

  const auth = request.headers.get('authorization')?.trim() ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice('Bearer '.length).trim();
  return token.length > 0 && token === expected;
}

const devQuerySchema = z.object({
  source: z.enum(['frontend', 'backend', 'both']),
  terms: z.string().describe('Space-separated search terms for the codebase route graph.'),
  limit: z.number().int().min(1).max(25),
});

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  if (!hasValidApiKey(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });

  let body: { query?: string };
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const query = body.query?.trim() ?? '';
  if (query.length < 2) return Response.json({ error: 'query must be at least 2 characters' }, { status: 400 });

  // gpt-5.3-codex turns the NL question into a structured graph query.
  let gen;
  try {
    gen = await generateObject({
      model: DEV_QUERY_MODEL,
      schema: devQuerySchema,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Generate a codebase route-graph query for the question. Overview: ${JSON.stringify(GRAPH_OVERVIEW)}`,
        },
        { role: 'user', content: query },
      ],
    });
  } catch {
    return Response.json({ error: 'Could not generate a graph query' }, { status: 502 });
  }

  const { source, terms, limit } = gen.object;
  const frontend = source === 'backend' ? [] : searchFrontendGraph(terms, limit);
  const backend = source === 'frontend' ? [] : searchBackendGraph(terms, limit);
  const hits = [...frontend, ...backend];

  if (!hits.length) return Response.json({ answer: '', citations: [], insufficientEvidence: true });

  // Each route hit becomes a citable context node.
  const contextNodes: ContextNode[] = hits.map((h, i) => ({
    id: `${h.source}:${h.method}:${h.route}`,
    label: `${h.method} ${h.route}`,
    url: h.route,
    snippet: `${h.source} route: ${h.method} ${h.route}`,
  }));

  // Route hits carry no traversal depth; escalate only on breadth.
  const tier = decideModelTier({
    seeds: hits.map((_, i) => ({ nodeId: String(i), score: 1 })),
    subgraph: { maxSeedHopDistance: 1, distinctSourceArticles: contextNodes.length },
  });

  const answer = await answerFromContext({ query, contextNodes, tier });
  return Response.json(answer);
}
