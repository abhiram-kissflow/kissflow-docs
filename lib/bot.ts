import { createHash } from 'node:crypto';
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createWebAdapter } from '@chat-adapter/web';
import { createMemoryState } from '@chat-adapter/state-memory';
import { Chat } from 'chat';
import { toAiMessages } from 'chat/ai';
import { z } from 'zod';
import {
  GRAPH_OVERVIEW,
  readHelpArticle,
  searchBackendGraph,
  searchFrontendGraph,
  searchHelpArticles,
} from '@/lib/rag/knowledge';

const BOT_USER = 'kissflow-docs-assistant';
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-nano';

const SYSTEM_PROMPT = `You are the Kissflow Docs assistant.

You must answer using three retrieval sources:
1) Help articles from this docs site.
2) Frontend graph snapshot (project: ${GRAPH_OVERVIEW.frontend.project}).
3) Backend graph snapshot (project: ${GRAPH_OVERVIEW.backend.project}).

Graph summary:
- Frontend: ${GRAPH_OVERVIEW.frontend.routes} routes, ${GRAPH_OVERVIEW.frontend.functions} functions, ${GRAPH_OVERVIEW.frontend.methods} methods.
- Backend: ${GRAPH_OVERVIEW.backend.routes} routes, ${GRAPH_OVERVIEW.backend.functions} functions, ${GRAPH_OVERVIEW.backend.methods} methods.

Rules:
- For product/how-to questions, use help-article tools first.
- For implementation/API/architecture questions, query BOTH frontend and backend graph tools.
- Never invent endpoints or behavior.
- If a source cannot answer the question, say that clearly.
- Keep responses concise.

Citations:
- Cite help article URLs as markdown links.
- Cite graph evidence inline as code labels:
  - frontend: \`[frontend-graph: <route>]\`
  - backend: \`[backend-graph: <route>]\``;

function getStableUserId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() ?? '';
  const userAgent = request.headers.get('user-agent') ?? '';
  const basis = `${ip}|${userAgent}`;
  const digest = createHash('sha256').update(basis).digest('hex').slice(0, 20);
  return `anon-${digest || 'web'}`;
}

export const bot = new Chat({
  userName: BOT_USER,
  adapters: {
    web: createWebAdapter({
      userName: BOT_USER,
      getUser: (request) => ({ id: getStableUserId(request) }),
      persistMessageHistory: true,
    }),
  },
  state: createMemoryState(),
});

bot.onDirectMessage(async (thread) => {
  if (!process.env.OPENAI_API_KEY) {
    await thread.post(
      'AI is not configured yet. Set `OPENAI_API_KEY` in your environment to enable the assistant.',
    );
    return;
  }

  const history = await thread.adapter.fetchMessages(thread.id, { limit: 24 });
  const aiMessages = await toAiMessages(history.messages);

  const result = streamText({
    model: openai(MODEL),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...aiMessages,
    ],
    temperature: 0.1,
    tools: {
      search_help_articles: tool({
        description:
          'Search Kissflow help articles. Use this first for user-facing product questions.',
        inputSchema: z.object({
          query: z.string().min(2),
        }),
        execute: async ({ query }) => ({ results: searchHelpArticles(query) }),
      }),
      read_help_article: tool({
        description:
          'Read one help article by its site-relative URL, e.g. /docs/build/decision-tables/overview.',
        inputSchema: z.object({
          url: z.string().min(2),
        }),
        execute: async ({ url }) => {
          const page = readHelpArticle(url);
          if (!page) return { error: `No help article found at ${url}` };
          return page;
        },
      }),
      search_frontend_graph: tool({
        description:
          'Search the frontend codebase graph snapshot for route and API patterns.',
        inputSchema: z.object({
          query: z.string().min(2),
        }),
        execute: async ({ query }) => ({ results: searchFrontendGraph(query) }),
      }),
      search_backend_graph: tool({
        description:
          'Search the backend codebase graph snapshot for route and API patterns.',
        inputSchema: z.object({
          query: z.string().min(2),
        }),
        execute: async ({ query }) => ({ results: searchBackendGraph(query) }),
      }),
    },
  });

  await thread.post(result.fullStream);
});
