# Docs AI Agent — Design Spec

**Date:** 2026-06-11
**Status:** Approved
**Goal:** Embed a native AI chat assistant in the Kissflow docs site that answers questions using agentic search over the docs content, with real citations.

## Constraints

- Docs site is a static export (`output: 'export'` in `next.config.mjs`) deployed to GitHub Pages. No server-side code can run in the docs deployment, and no API key may ever reach client JavaScript.
- LLM: OpenAI `gpt-5-mini` (cheap, tool-calling capable). Configurable fallback to `gpt-5-nano`.
- Budget: pennies per question. Target ≈ $0.002/question; no vector DB or paid SaaS.
- UI must feel native to the existing fumadocs theme (light/dark, brand styling).

## Architecture

```
┌─ kissflow-docs (GitHub Pages, static) ─────────┐
│  components/ai-chat.tsx  ← chat panel, SSE     │
│  ├─ Search dialog "Ask AI" tab (⌘K)            │
│  └─ Floating bubble (bottom-right, same panel) │
└──────────────┬─────────────────────────────────┘
               │ POST /chat (SSE stream, CORS-locked)
┌──────────────▼─────────────────────────────────┐
│  Cloudflare Worker (free tier)                 │
│  ├─ OPENAI_API_KEY as Worker secret            │
│  ├─ gpt-5-mini agent loop (max 5 tool calls)   │
│  ├─ tool: search_docs → MiniSearch over chunks │
│  ├─ tool: read_page  → full page markdown      │
│  └─ rate limit: per-IP 10/min, 150/day         │
└──────────────▲─────────────────────────────────┘
               │ chunks.json (build-time)
┌──────────────┴─────────────────────────────────┐
│  scripts/build-agent-index.ts                  │
│  content/**/*.mdx → {url, title, headings,     │
│  text} chunks → deployed with Worker           │
└────────────────────────────────────────────────┘
```

## Components

### 1. Worker — `agent-worker/` (same repo)

- Cloudflare Worker with `wrangler.toml`; deployed independently of the Pages site (manual `wrangler deploy` initially; GitHub Action later if desired).
- **Endpoint:** `POST /chat`. Request body: `{ messages: [{role, content}, ...] }` (client-held history, capped at 10 turns client-side, validated server-side). Response: SSE stream with two event types — `token` (answer text delta) and `status` (tool activity, e.g. "Searching docs…"), plus a final `sources` event listing cited page URLs.
- **Agent loop:** OpenAI Chat Completions with tools, max 5 tool-call rounds, then forced answer. Max output tokens capped (~1024).
  - `search_docs(query)` — full-text search (MiniSearch) over the chunk index; returns top 8 hits: `{url, title, heading, snippet}`.
  - `read_page(url)` — returns full markdown of one docs page from the bundled index (capped length).
- **System prompt:** answer only from retrieved docs content; cite source pages as markdown links; if the docs don't cover it, say so — never invent; refuse off-topic/non-Kissflow questions politely; keep answers concise.
- **Index:** `chunks.json` generated at build time, shipped as a Worker static asset (atomic with deploy — no KV sync drift). MiniSearch index built once per Worker isolate startup and cached in module scope.
- **Secrets/config:** `OPENAI_API_KEY` via `wrangler secret`. Model name via Worker var.

### 2. Index builder — `scripts/build-agent-index.ts`

- Parses `content/**/*.mdx` (gray-matter for frontmatter, strip JSX/imports), chunks per heading section.
- Chunk shape: `{ id, url, title, heading, text }`. URL derived the same way fumadocs derives routes (including basePath handling on the client side, not in stored URLs — store site-relative paths).
- Output: `agent-worker/assets/chunks.json`. Run before Worker deploy.

### 3. Frontend — native UI in this repo

- `components/ai-chat.tsx` — chat panel: message list, streaming markdown rendering, status line during tool calls, source citation chips linking to docs pages, input box, "new chat" reset. Conversation history kept in client state (sessionStorage persistence optional, not required for v1).
- **Search dialog integration:** replace fumadocs default `SearchDialog` with a custom one offering two tabs — existing Orama search and "Ask AI" (renders the chat panel).
- **Floating bubble:** bottom-right launcher on all docs pages; opens the same chat panel in a popover/sheet. Hidden on mobile widths if it crowds the layout (judgment call at implementation).
- Worker URL via `NEXT_PUBLIC_AGENT_URL` env var so staging/prod can differ.

## Data flow

1. User submits question → client appends to history → `POST /chat` with full history.
2. Worker validates origin + rate limit → runs agent loop → streams `status`/`token`/`sources` events.
3. Client renders stream; on completion appends assistant message (with sources) to history.
4. Stateless server: nothing stored. Turn cap (10) bounds token growth.

## Security / abuse controls

- API key only in Worker secret; never in client.
- CORS + `Origin` header check locked to the docs domain (and localhost for dev).
- Per-IP rate limiting via Cloudflare rate-limit binding: 10 req/min, 150 req/day.
- Request size cap; message count cap; max output tokens cap.
- System prompt scoping (docs-only answers) limits free-rider misuse value.

## Error handling

- 429 (rate limit) → panel shows friendly "Slow down — try again in a minute."
- Worker/OpenAI failure → "Assistant unavailable — try the search tab."
- Empty retrieval → model instructed to answer "the docs don't cover this" with a link to search.
- SSE disconnect mid-stream → partial answer kept, retry button shown.

## Cost expectations

- gpt-5-mini, ~3 calls/question, small contexts ≈ $0.002/question; 1k questions/mo ≈ $2.
- Cloudflare free tier: 100k requests/day — far above expected traffic.

## Testing

- Worker: vitest + miniflare (or `wrangler dev` harness) — search tool relevance smoke tests, rate-limit behavior, CORS rejection, request validation.
- Index builder: snapshot test on a fixture MDX file (chunking + URL derivation).
- Frontend: manual e2e against staging Worker (stream rendering, citations, error states, both entry points).

## Out of scope (v1)

- Conversation persistence/analytics, feedback thumbs, vector embeddings, multi-language, auth.
