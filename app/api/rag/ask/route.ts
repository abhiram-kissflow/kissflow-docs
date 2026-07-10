import { embed } from 'ai';
import { EMBEDDING_MODEL } from '@/lib/rag/model-router';
import { seedSearch, constrainSubgraph, loadContentGraph } from '@/lib/rag/content-graph';
import { decideModelTier } from '@/lib/rag/escalation';
import { answerFromContext, type ContextNode } from '@/lib/rag/answer';

export const runtime = 'nodejs';

const SEED_K = 6;
const MAX_NODES = 12;
const MAX_HOPS = 2;
const SEED_SCORE_FLOOR = 0.2;

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  let body: { query?: string };
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const query = body.query?.trim() ?? '';
  if (query.length < 2) {
    return Response.json({ error: 'query must be at least 2 characters' }, { status: 400 });
  }

  const { graph, index } = loadContentGraph();
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: query });
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

  const result = answerFromContext({ query, contextNodes, tier });
  return result.toTextStreamResponse();
}
