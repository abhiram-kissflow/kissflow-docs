// Same-origin CORS proxy for the Scalar API reference "Test Request" feature.
//
// Why: the OpenAPI server is https://{subdomain}.kissflow.com. In the hosted
// docs app, try-it fires from the browser cross-origin and the Kissflow API
// returns no Access-Control-Allow-Origin for the docs domain, so the browser
// blocks it. The standalone Scalar desktop client isn't subject to CORS, which
// is why it works there. Scalar's fix is a proxy; we self-host it here (as one
// more Node route handler, same pattern as api/rag/ask) so credentials forward
// through our own function instead of the public proxy.scalar.com.
//
// Contract (from @scalar/helpers redirectToProxy): the client sends the request
// to this route with the real target in ?scalar_url=<absolute url>, preserving
// the original method/headers/body. We forward and stream the response back.
//
import { isAllowedTarget } from './target';

export const runtime = 'nodejs';

// Browsers forbid these headers on outgoing fetches, so Scalar sends them as
// x-scalar-* and expects the proxy to restore the real header name.
const FORBIDDEN_HEADER_REWRITE: Record<string, string> = {
  'x-scalar-date': 'date',
  'x-scalar-dnt': 'dnt',
  'x-scalar-referer': 'referer',
  'x-scalar-user-agent': 'user-agent',
};

// Request headers we must not forward verbatim (connection/host/encoding are
// managed by the fetch layer; origin/cookie are handled specially below).
const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'origin',
  'cookie',
  // Browser-fingerprint / navigation headers a server-side client (curl, the
  // Scalar desktop app) never sends. Forwarding the browser's Referer +
  // sec-fetch-* to Kissflow makes the call look like it originates from the
  // docs domain, which trips Cloudflare/domain checks (DomainMissMatchError).
  // Strip them so the proxied request looks like a clean API call.
  'referer',
  'user-agent',
  'accept-language',
  'priority',
  'dnt',
  'pragma',
  'cache-control',
  'upgrade-insecure-requests',
]);

/** Strip the explicit set plus any client-hint / fetch-metadata header. */
function shouldStripRequestHeader(lower: string): boolean {
  return (
    STRIP_REQUEST_HEADERS.has(lower) ||
    lower.startsWith('sec-') ||
    lower.startsWith('x-scalar-') // handled separately below
  );
}

// Response headers the fetch layer already decoded or that we replace.
const STRIP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function handle(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get('scalar_url');

  if (!target) {
    return new Response('Missing scalar_url query parameter', {
      status: 400,
      headers: CORS_HEADERS,
    });
  }
  if (!isAllowedTarget(target)) {
    return new Response('Forbidden: scalar_url must be an absolute *.kissflow.com URL', {
      status: 403,
      headers: CORS_HEADERS,
    });
  }

  // Build the outbound headers.
  const outHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Restore browser-forbidden headers the client opted to send via x-scalar-*.
    if (lower in FORBIDDEN_HEADER_REWRITE) {
      outHeaders.set(FORBIDDEN_HEADER_REWRITE[lower], value);
      return;
    }
    if (shouldStripRequestHeader(lower)) return;
    outHeaders.set(key, value);
  });
  // Cookies must be opted into explicitly via x-scalar-cookie.
  const scalarCookie = request.headers.get('x-scalar-cookie');
  if (scalarCookie) outHeaders.set('cookie', scalarCookie);
  outHeaders.delete('x-scalar-cookie');

  const method = request.method.toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers: outHeaders,
      body,
      redirect: 'follow',
    });
  } catch (err) {
    return new Response(`Proxy request failed: ${(err as Error).message}`, {
      status: 502,
      headers: CORS_HEADERS,
    });
  }

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (STRIP_RESPONSE_HEADERS.has(lower)) return;
    if (lower.startsWith('access-control-')) return;
    resHeaders.set(key, value);
  });
  for (const [k, v] of Object.entries(CORS_HEADERS)) resHeaders.set(k, v);
  resHeaders.set('X-Forwarded-Host', upstream.url);

  // Stream the body straight through — keeps SSE / large responses cheap.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
