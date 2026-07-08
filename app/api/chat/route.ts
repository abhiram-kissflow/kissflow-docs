import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { searchHelpArticles } from '@/lib/rag/help';
import { searchBackendGraph, searchFrontendGraph } from '@/lib/rag/graph';

export const runtime = 'nodejs';

function getLatestUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return '';

  return lastUser.parts
    .filter((part): part is Extract<(typeof lastUser.parts)[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .trim();
}

function contextBlock(query: string): string {
  const helpHits = searchHelpArticles(query, 4);
  const frontendHits = searchFrontendGraph(query, 6);
  const backendHits = searchBackendGraph(query, 6);

  const help = helpHits
    .map((hit, i) => `${i + 1}. ${hit.title} (${hit.url})\n   ${hit.snippet}`)
    .join('\n');
  const frontend = frontendHits.map((hit) => `- ${hit.method} ${hit.route}`).join('\n');
  const backend = backendHits.map((hit) => `- ${hit.method} ${hit.route}`).join('\n');

  return [
    'Grounding context (use this before answering):',
    '',
    'Help article matches:',
    help || '- none',
    '',
    'Frontend graph route matches:',
    frontend || '- none',
    '',
    'Backend graph route matches:',
    backend || '- none',
  ].join('\n');
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  const body = (await request.json()) as { messages?: UIMessage[] };
  const messages = body.messages ?? [];
  const query = getLatestUserText(messages);
  const grounding = contextBlock(query);

  const result = streamText({
    model: openai(process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'),
    temperature: 0.1,
    messages: await convertToModelMessages([
      {
        id: 'system-0',
        role: 'system',
        parts: [
          {
            type: 'text',
            text: `You are the Kissflow docs assistant.

Always ground answers in the provided help-article and graph context.
If context is missing, say what is missing.
For product guidance, prioritize help articles and cite URLs inline.
For technical route behavior, reference frontend/backend routes explicitly.
Keep responses concise and structured.`,
          },
        ],
      } as UIMessage,
      {
        id: 'system-1',
        role: 'system',
        parts: [{ type: 'text', text: grounding }],
      } as UIMessage,
      ...messages,
    ]),
  });

  return result.toUIMessageStreamResponse();
}
