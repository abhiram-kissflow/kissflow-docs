import {
  convertToModelMessages,
  embed,
  streamText,
  type UIMessage,
} from 'ai';
import {
  seedSearch,
  constrainSubgraph,
  loadContentGraph,
  type GraphNode,
} from '@/lib/rag/content-graph';
import { decideModelTier } from '@/lib/rag/escalation';
import { answerLanguageRule } from '@/lib/rag/answer';
import { EMBEDDING_MODEL, resolveAnswerModel } from '@/lib/rag/model-router';

export const runtime = 'nodejs';

// Same retrieval knobs as the hero engine (app/api/rag/ask/route.ts).
const SEED_K = 6;
const MAX_NODES = 12;
const MAX_HOPS = 2;
// Calibrated with /api/rag/ask (2026-07-14 benchmark) — catches garbage only.
const SEED_SCORE_FLOOR = 0.45;

// Same grounding + answer style as the hero engine (lib/rag/answer.ts SYSTEM),
// minus the citation-object machinery: the chat widget renders markdown text,
// so we stream text and abstain in prose instead of a JSON flag.
const SYSTEM = `You are Kissflow's docs assistant. You answer users of the
Kissflow platform from the provided documentation CONTEXT only.

Grounding (never break these):
1. Answer ONLY from the provided CONTEXT. Never use outside knowledge.
2. If the CONTEXT cannot support a confident answer, say briefly that the docs
   don't cover it — do not guess.

Style (how to write a grounded answer):
- For "how do I…" / setup / step questions: open with one short sentence naming
  the goal, then give clear numbered steps the user can follow. Be complete.
- For everything else: be punchy and concise — a direct sentence or two.
- Write plainly and actively (omit needless words; no preamble like "Based on
  the context"). Use markdown: numbered lists for steps, **bold** for UI labels,
  inline links to the source urls where a "read more" genuinely helps, and
  GitHub-flavored markdown tables when the user asks for tabular data or when
  comparing options side by side.
- When earlier turns are provided, treat the new question as a follow-up in the
  same conversation.`;

/** All user turns, newest last, as plain text. */
function userTexts(messages: UIMessage[]): string[] {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) =>
      m.parts
        .filter((p): p is Extract<(typeof m.parts)[number], { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join(' ')
        .trim(),
    )
    .filter(Boolean);
}

function renderContext(nodes: GraphNode[]): string {
  if (!nodes.length) return 'CONTEXT: (empty)';
  return [
    'CONTEXT:',
    ...nodes.map((n) => `- url: ${n.url}\n  title: ${n.label}\n  snippet: ${n.snippet}`),
  ].join('\n');
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  const body = (await request.json()) as { messages?: UIMessage[]; locale?: string };
  const messages = body.messages ?? [];
  const locale = body.locale === 'es' ? 'es' : 'en';

  const queries = userTexts(messages);
  const query = queries.at(-1) ?? '';
  const prevUser = queries.at(-2) ?? '';

  // Conversational retrieval: fold in the previous turn so referential
  // follow-ups ("how do I create one?") retrieve the right docs.
  const retrievalText = prevUser ? `${prevUser}\n${query}` : query;

  let contextNodes: GraphNode[] = [];
  let tier: 'luna' | 'terra' = 'luna';
  if (query.length >= 2) {
    const { graph, index } = loadContentGraph();
    const { embedding } = await embed({ model: EMBEDDING_MODEL, value: retrievalText });
    const seeds = seedSearch(embedding, SEED_K, graph, index.vectors);

    // Weak top seed → leave CONTEXT empty so the model abstains (SYSTEM rule 2)
    // instead of force-fitting unrelated docs. ponytail: no separate short-circuit
    // stream — an empty-context call is rare and keeps this one code path.
    if (seeds.length && seeds[0].score >= SEED_SCORE_FLOOR) {
      const constrained = constrainSubgraph(
        seeds.map((s) => s.nodeId),
        { maxNodes: MAX_NODES, maxHops: MAX_HOPS },
        graph,
      );
      contextNodes = constrained.nodes;
      tier = decideModelTier({ seeds });
    }
  }

  const result = streamText({
    // Same model as the hero: gpt-5.6-luna, escalating to terra on the same
    // signals. No temperature — gpt-5.6 reasoning models ignore it and warn.
    model: resolveAnswerModel(tier),
    messages: await convertToModelMessages([
      {
        id: 'system-0',
        role: 'system',
        parts: [{ type: 'text', text: SYSTEM + answerLanguageRule(locale) }],
      } as UIMessage,
      {
        id: 'system-1',
        role: 'system',
        parts: [{ type: 'text', text: renderContext(contextNodes) }],
      } as UIMessage,
      ...messages,
    ]),
  });

  return result.toUIMessageStreamResponse();
}
