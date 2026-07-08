import { GRAPH_OVERVIEW, searchBackendGraph, searchFrontendGraph } from '@/lib/rag/graph';

export const runtime = 'nodejs';

type GraphSource = 'frontend' | 'backend' | 'both';
const MAX_BODY_BYTES = 8 * 1024;
const MAX_LIMIT = 25;

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

function sanitizeLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 12;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request)) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  if (!hasValidApiKey(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  let payload: { source?: GraphSource; query?: string; limit?: number };
  try {
    payload = (await request.json()) as { source?: GraphSource; query?: string; limit?: number };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const query = payload.query?.trim() ?? '';
  if (query.length < 2) {
    return Response.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  const source: GraphSource = payload.source ?? 'both';
  if (source !== 'frontend' && source !== 'backend' && source !== 'both') {
    return Response.json({ error: 'source must be frontend, backend, or both' }, { status: 400 });
  }

  const limit = sanitizeLimit(payload.limit);

  const frontend = source === 'backend' ? [] : searchFrontendGraph(query, limit);
  const backend = source === 'frontend' ? [] : searchBackendGraph(query, limit);

  return Response.json({
    query,
    source,
    limit,
    overview: GRAPH_OVERVIEW,
    results: {
      frontend,
      backend,
    },
  });
}
