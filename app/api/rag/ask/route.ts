import { askFromRag } from '@/lib/rag/ask-service';
import type { HistoryTurn } from '@/lib/rag/answer';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  let body: { query?: string; history?: HistoryTurn[]; locale?: string };
  try {
    body = (await request.json()) as { query?: string; history?: HistoryTurn[]; locale?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const query = body.query?.trim() ?? '';
  if (query.length < 2) {
    return Response.json({ error: 'query must be at least 2 characters' }, { status: 400 });
  }

  const history = (body.history ?? [])
    .filter((turn) => (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string')
    .slice(-6);
  const result = await askFromRag({
    query,
    history,
    locale: body.locale === 'es' ? 'es' : 'en',
  });

  // Validation happens before this response is written, so source cards can
  // contain only citations bound to rendered claims.
  return Response.json(result.answer, {
    headers: { 'x-rag-sources': encodeURIComponent(JSON.stringify(result.sources)) },
  });
}
