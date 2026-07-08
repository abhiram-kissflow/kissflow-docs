import type { ChatMessage } from './http';
import type { SearchApi } from './search';

export type AgentEvent =
  | { type: 'status'; text: string }
  | { type: 'token'; text: string }
  | { type: 'sources'; sources: { url: string; title: string }[] }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string, as OpenAI returns it
}

export interface ModelResponse {
  content?: string;
  toolCalls?: ModelToolCall[];
}

/** OpenAI-conversation message including tool plumbing. */
export type LoopMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'assistant'; content: null; tool_calls: unknown[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type CallModel = (
  messages: LoopMessage[],
  options: { allowTools: boolean },
) => Promise<ModelResponse>;

const MAX_ROUNDS = 5;

const SYSTEM_PROMPT = `You are the Kissflow Docs assistant, embedded in the Kissflow documentation site.

Rules:
- Before answering, ALWAYS use search_docs to find relevant pages, and read_page to read the most promising ones. Base your answer only on what you read.
- Cite every page you used as a markdown link with its site-relative URL, e.g. [Evaluation settings](/docs/build/decision-tables/evaluation-settings).
- If the documentation does not cover the question, say so plainly and suggest the search box. Never invent features or behavior.
- Only answer questions about Kissflow and its documentation. Politely decline anything else.
- Keep answers concise. Use short paragraphs, lists, and code blocks where helpful.`;

export async function runAgent(input: {
  messages: ChatMessage[];
  search: SearchApi;
  emit: (event: AgentEvent) => void;
  callModel: CallModel;
}): Promise<void> {
  const { search, emit, callModel } = input;
  const loop: LoopMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...input.messages];
  const readUrls = new Map<string, string>(); // url -> title

  try {
    for (let round = 0; round <= MAX_ROUNDS; round++) {
      const allowTools = round < MAX_ROUNDS;
      const response = await callModel(loop, { allowTools });

      if (response.toolCalls && response.toolCalls.length > 0 && allowTools) {
        loop.push({
          role: 'assistant',
          content: null,
          tool_calls: response.toolCalls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: c.arguments },
          })),
        });
        for (const call of response.toolCalls) {
          loop.push({
            role: 'tool',
            tool_call_id: call.id,
            content: executeTool(call, search, emit, readUrls),
          });
        }
        continue;
      }

      const answer = response.content ?? 'Sorry, I could not produce an answer.';
      emit({ type: 'token', text: answer });
      emit({
        type: 'sources',
        sources: [...readUrls.entries()].map(([url, title]) => ({ url, title })),
      });
      emit({ type: 'done' });
      return;
    }
    emit({ type: 'error', message: 'The assistant ran out of steps. Please try again.' });
  } catch {
    emit({ type: 'error', message: 'The assistant is unavailable right now. Try the search tab.' });
  }
}

function executeTool(
  call: ModelToolCall,
  search: SearchApi,
  emit: (event: AgentEvent) => void,
  readUrls: Map<string, string>,
): string {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    return 'Error: invalid JSON arguments';
  }

  if (call.name === 'search_docs' && typeof args.query === 'string') {
    emit({ type: 'status', text: `Searching docs for "${args.query}"…` });
    const hits = search.search(args.query);
    if (hits.length === 0) return 'No results found.';
    return JSON.stringify(hits);
  }

  if (call.name === 'read_page' && typeof args.url === 'string') {
    emit({ type: 'status', text: `Reading ${args.url}…` });
    const page = search.getPage(args.url);
    if (!page) return `Error: no page at ${args.url}`;
    readUrls.set(page.url, page.title);
    return `# ${page.title}\n\n${page.text}`;
  }

  return `Error: unknown tool ${call.name}`;
}

/** Tool schemas sent to OpenAI — exported for use by the model caller. */
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_docs',
      description: 'Full-text search across the Kissflow documentation. Returns matching sections with url, title, heading and snippet.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search keywords' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_page',
      description: 'Read the full text of a documentation page by its site-relative url, e.g. /docs/build/decision-tables/overview.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Site-relative page url from search results' } },
        required: ['url'],
      },
    },
  },
] as const;
