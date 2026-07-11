import { generateObject } from 'ai';
import { citationAnswerSchema } from './citation-schema';
import { resolveAnswerModel } from './model-router';

export interface ContextNode {
  id: string;
  label: string;
  url: string;
  snippet: string;
}

const SYSTEM = `You are Kissflow's grounded answering engine.

You are given a constrained set of knowledge-graph nodes as CONTEXT. Each node
has an id, a source url, and a snippet.

Rules, in priority order:
1. Answer ONLY from the provided CONTEXT. Never use outside knowledge.
2. Every claim in your answer must be supported by a node you cite by its id,
   with the exact snippet you relied on.
3. If the CONTEXT does not contain enough information to answer confidently,
   set insufficientEvidence to true, leave answer empty and citations empty,
   and do not guess.
4. Keep answers concise and directly responsive to the question.`;

function renderContext(nodes: ContextNode[]): string {
  if (!nodes.length) return 'CONTEXT: (empty)';
  return [
    'CONTEXT:',
    ...nodes.map((n) => `- id: ${n.id}\n  url: ${n.url}\n  title: ${n.label}\n  snippet: ${n.snippet}`),
  ].join('\n');
}

/**
 * Runs the grounded, citation-enforced answer over a constrained context.
 * Resolves to the validated citation object.
 *
 * ponytail: generateObject, not streamObject — the installed @ai-sdk/openai
 * (3.0.82, pre-GPT-5.6) hangs on gpt-5.6 structured-output *streaming*, while
 * non-streaming structured output works. No live consumer needs token streaming
 * yet; switch back to streamObject when the SDK supports 5.6 streaming.
 */
export async function answerFromContext(input: {
  query: string;
  contextNodes: ContextNode[];
  tier: 'luna' | 'terra';
}) {
  const { object } = await generateObject({
    model: resolveAnswerModel(input.tier),
    schema: citationAnswerSchema,
    temperature: 0,
    system: SYSTEM,
    messages: [
      { role: 'system', content: renderContext(input.contextNodes) },
      { role: 'user', content: input.query },
    ],
  });
  return object;
}
