import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from 'ai';
import { askFromRag } from '@/lib/rag/ask-service';
import type { HistoryTurn } from '@/lib/rag/answer';

export const runtime = 'nodejs';

/** All user turns, newest last, as plain text. Assistant prose is never evidence. */
function userTexts(messages: UIMessage[]): string[] {
  return messages
    .filter((message) => message.role === 'user')
    .map((message) =>
      message.parts
        .filter((part): part is Extract<(typeof message.parts)[number], { type: 'text' }> => part.type === 'text')
        .map((part) => part.text)
        .join(' ')
        .trim(),
    )
    .filter(Boolean);
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  let body: { messages?: UIMessage[]; locale?: string };
  try {
    body = (await request.json()) as { messages?: UIMessage[]; locale?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userQuestions = userTexts(body.messages ?? []);
  const query = userQuestions.at(-1) ?? '';
  const history: HistoryTurn[] = userQuestions
    .slice(0, -1)
    .map((content) => ({ role: 'user' as const, content }));
  const result = await askFromRag({
    query,
    history,
    locale: body.locale === 'es' ? 'es' : 'en',
  });

  // The UI-message wire format is retained for useChat. The answer is emitted
  // as one validated delta because citation/media validation requires the full
  // structured model object before any public content can be released.
  const stream = createUIMessageStream({
    execute({ writer }) {
      const textId = 'rag-answer';
      writer.write({ type: 'start' });
      if (result.answer.answer) {
        writer.write({ type: 'text-start', id: textId });
        writer.write({ type: 'text-delta', id: textId, delta: result.answer.answer });
        writer.write({ type: 'text-end', id: textId });
      }
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
  });
  return createUIMessageStreamResponse({
    stream,
    headers: { 'x-rag-sources': encodeURIComponent(JSON.stringify(result.sources)) },
  });
}
