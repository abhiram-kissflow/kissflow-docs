import { embed } from 'ai';
import { EMBEDDING_MODEL } from '@/lib/rag/model-router';
import { seedSearch, constrainSubgraph, loadContentGraph } from '@/lib/rag/content-graph';
import { decideModelTier } from '@/lib/rag/escalation';
import { answerFromContext, type ContextNode, type HistoryTurn } from '@/lib/rag/answer';

export const runtime = 'nodejs';

const SEED_K = 6;
const MAX_NODES = 12;
const MAX_HOPS = 2;
const SEED_SCORE_FLOOR = 0.2;

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  let body: { query?: string; history?: HistoryTurn[] };
  try {
    body = (await request.json()) as { query?: string; history?: HistoryTurn[] };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const query = body.query?.trim() ?? '';
  if (query.length < 2) {
    return Response.json({ error: 'query must be at least 2 characters' }, { status: 400 });
  }
  // Keep only the last few turns to bound the prompt.
  const history = (body.history ?? [])
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
    .slice(-6);

  const { graph, index } = loadContentGraph();
  // Retrieve on the last user question + the current one, so referential
  // follow-ups ("how do I create one?") retrieve the right docs. Cheap
  // conversational retrieval — no LLM query rewrite.
  const lastUserTurn = [...history].reverse().find((t) => t.role === 'user')?.content ?? '';
  const retrievalText = lastUserTurn ? `${lastUserTurn}\n${query}` : query;
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: retrievalText });
  const seeds = seedSearch(embedding, SEED_K, graph, index.vectors);

  // Honest short-circuit: nothing relevant retrieved → abstain without a model call.
  if (!seeds.length || seeds[0].score < SEED_SCORE_FLOOR) {
    return Response.json({ answer: '', citations: [], insufficientEvidence: true });
  }

  const constrained = constrainSubgraph(
    seeds.map((s) => s.nodeId),
    { maxNodes: MAX_NODES, maxHops: MAX_HOPS },
    graph,
  );
  const tier = decideModelTier({ seeds, subgraph: constrained.stats });
  const contextNodes: ContextNode[] = constrained.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    url: n.url,
    snippet: n.snippet,
  }));

  // The retrieved articles (for the client's "relevant articles" pane) are known
  // before generation — send them in a header so the pane renders immediately
  // while the answer streams in the body.
  const sources = contextNodes.map((n) => ({ url: n.url, title: n.label }));

  const result = answerFromContext({ query, contextNodes, tier, history });
  return result.toTextStreamResponse({
    headers: { 'x-rag-sources': encodeURIComponent(JSON.stringify(sources)) },
  });
}
