import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import graph from '@/lib/rag/content-graph/graph.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// API endpoints and SDK methods live outside content/ (Scalar page + external
// developer docs), so the Orama index never sees them. Merge them in here from
// the RAG content graph instead of maintaining a second index.
const extras = (graph.nodes as { id: string; label: string; url: string; snippet?: string }[])
  .filter((n) => n.id.startsWith('api:') || n.id.startsWith('sdk:'))
  .map((n) => ({
    id: n.id,
    title: n.label,
    url: n.url,
    breadcrumb: n.id.startsWith('api:') ? 'API Reference' : 'SDK',
    haystack: `${n.label} ${(n.snippet ?? '').slice(0, 300)}`.toLowerCase(),
  }));

function searchExtras(query: string) {
  const tokens = query.toLowerCase().split(/[^a-z0-9{}/_-]+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return [];
  return extras
    .filter((e) => tokens.every((t) => e.haystack.includes(t)))
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      type: 'page' as const,
      content: e.title,
      breadcrumbs: ['Docs', 'Developers', e.breadcrumb],
      url: e.url,
      // fumadocs' dialog window.open()s external items instead of router.push.
      external: e.url.startsWith('http') || undefined,
    }));
}

const api = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  localeMap: {
    en: { language: 'english' },
    es: { language: 'spanish' },
  },
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  // fumadocs spreads the request's (absent) limit over searchAdvanced's default,
  // disabling the result cap entirely — without this, broad terms return the whole
  // corpus (~800 rows, ~270KB) on every keystroke.
  if (!url.searchParams.has('limit')) url.searchParams.set('limit', '40');
  const res = await api.GET(new Request(url, request));

  const query = url.searchParams.get('query') ?? '';
  const hits = res.ok && query.length > 1 ? searchExtras(query) : [];
  const body = hits.length > 0 ? [...hits, ...((await res.json()) as unknown[])] : null;

  const out = body ? Response.json(body) : res;
  // Index only changes per deploy, and Vercel purges the CDN cache on deploy.
  out.headers.set('cache-control', 'public, s-maxage=604800, stale-while-revalidate=604800');
  return out;
}
