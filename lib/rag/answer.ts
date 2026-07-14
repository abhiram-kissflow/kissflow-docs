import { streamObject, type ModelMessage } from 'ai';
import { citationAnswerSchema } from './citation-schema';
import type { SourceMedia } from './content-sections';
import { resolveAnswerModel } from './model-router';

export interface ContextNode {
  id: string;
  label: string;
  url: string;
  snippet: string;
  /** Evidence media extracted from this exact documentation section. */
  media?: SourceMedia[];
}

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM = `You are Kissflow's docs answering engine. You help users of the
Kissflow platform by answering from the provided documentation.

You are given a constrained set of knowledge-graph nodes as CONTEXT. Each node
has an id, a source url, and a snippet.

Grounding (never break these):
1. Answer ONLY from the provided CONTEXT. Never use outside knowledge.
2. Put every rendered factual markdown block in claims. Every claim must name
   one or more citation IDs in citationIds. The answer field MUST be exactly
   the claim markdown blocks joined with a blank line: do not put any extra
   factual content in answer. Each citation must use an exact snippet from its
   documentation section. Never invent, paraphrase as a quote, or cite a
   snippet that does not occur in the section.
3. Set insufficientEvidence to true ONLY when nothing in the CONTEXT addresses
   the question. When the CONTEXT covers the question partially, give the
   grounded partial answer and say plainly what the docs don't cover — a useful
   grounded answer beats an abstention. But when the question asks about a
   capability or topic the CONTEXT never mentions at all (a deployment model,
   a feature, a plan the docs don't describe), set insufficientEvidence to
   true — related-but-off-topic context is not evidence.
4. Select media only in the media field when it belongs to a cited node and it
   directly helps the user complete or understand an answer step. Never select
   decorative, merely related, or unsupported media.
5. Every non-empty answer MUST end with a final markdown line linking the single
   most relevant context url, e.g.: Read more: [Article title](url). This line
   is mandatory — never omit it.

Style (how to write a grounded answer):
- For direct questions: be concise when a concise answer fully resolves the
  question.
- For "how do I…" / setup / step questions and complex questions: open with one
  short sentence naming the goal, then give complete, evidence-backed numbered
  steps the user can follow. Include all material supported details; do not
  shorten an answer merely to save tokens or meet an arbitrary length target.
- Never pad an answer. Detail must be proportionate to the question and the
  available evidence.
- Write plainly and actively (omit needless words; no filler, no preamble like
  "Based on the context"). Use markdown: numbered lists for steps, **bold** for
  UI labels, and GitHub-flavored markdown tables when the user asks for tabular
  data or when comparing options side by side.
- When earlier turns are provided, treat the new question as a follow-up in the
  same conversation.`;

/**
 * Answers must be written in the page's language. Localized answers (instead
 * of client-side translation) are the guardrail against browser auto-translate
 * mangling streamed answer text (glued words, dropped fragments).
 */
export function answerLanguageRule(locale?: string): string {
  if (locale === 'es') {
    return '\n\nWrite the entire answer in Spanish. Keep product names and UI labels exactly as they appear in the CONTEXT.';
  }
  return '\n\nWrite the entire answer in English.';
}

function renderContext(nodes: ContextNode[]): string {
  if (!nodes.length) return 'CONTEXT: (empty)';
  return [
    'CONTEXT:',
    ...nodes.map((n) => [
      `- id: ${n.id}\n  url: ${n.url}\n  title: ${n.label}\n  snippet: ${n.snippet}`,
      ...(n.media?.map((media) => `  media: id=${media.id}; kind=${media.kind}; alt=${media.alt}; url=${media.url}`) ?? []),
    ].join('\n')),
  ].join('\n');
}

/**
 * Streams a grounded, citation-enforced answer over a constrained context.
 * Returns the streamObject result so callers can stream the partial object.
 * (streamObject works with gpt-5.6 on @ai-sdk/openai >= 3.0.84.)
 */
export function answerFromContext(input: {
  query: string;
  contextNodes: ContextNode[];
  tier: 'luna' | 'terra';
  history?: HistoryTurn[];
  locale?: string;
}) {
  const priorTurns: ModelMessage[] = (input.history ?? []).map((t) => ({
    role: t.role,
    content: t.content,
  }));

  return streamObject({
    model: resolveAnswerModel(input.tier),
    schema: citationAnswerSchema,
    // no temperature: gpt-5.6 reasoning models ignore it and warn.
    system: SYSTEM + answerLanguageRule(input.locale),
    messages: [
      { role: 'system', content: renderContext(input.contextNodes) },
      ...priorTurns,
      { role: 'user', content: input.query },
    ],
  });
}
