import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  // Index only changes per deploy, and Vercel purges the CDN cache on deploy.
  res.headers.set('cache-control', 'public, s-maxage=604800, stale-while-revalidate=604800');
  return res;
}
