# Docs AI Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a native AI chat assistant in the Kissflow docs (static GitHub Pages site) backed by a Cloudflare Worker running an agentic-search loop on OpenAI `gpt-5-mini`.

**Architecture:** A build-time script chunks `content/**/*.mdx` into `agent-worker/assets/chunks.json`. A Cloudflare Worker (in `agent-worker/`, same repo, separate deploy) exposes `POST /chat`: it validates + rate-limits the request, then runs an OpenAI tool-calling loop with `search_docs` (MiniSearch over chunks) and `read_page` (full page text), streaming SSE events (`status`/`token`/`sources`/`done`/`error`) back. The frontend gets a chat panel (`components/ai-chat.tsx`) surfaced two ways: an "Ask AI" tab in the existing search dialog and a floating launcher on docs pages. The Worker is stateless; the client holds conversation history.

**Tech Stack:** Cloudflare Workers (wrangler, static assets binding, rate-limit binding), OpenAI Chat Completions via raw `fetch` (no SDK), MiniSearch, vitest (root, single setup), React 19 / fumadocs-ui v16, react-markdown.

**Key facts an engineer needs (verified against this repo):**
- Site is static export (`output: 'export'`), deployed to GitHub Pages at `https://abhiram-kissflow.github.io/kissflow-docs` (`NEXT_PUBLIC_BASE_PATH=/kissflow-docs` set in `.github/workflows/deploy.yml`). No server code in the Next app at runtime — the Worker is a separate deployment.
- Docs page URLs are `/docs/<path-relative-to-content-dir-minus-extension>`; `index.mdx` maps to its directory (`lib/shared.ts` defines `docsRoute = '/docs'`).
- Search dialog is custom already: `components/provider.tsx` passes `components/search.tsx` to `RootProvider`. We extend that file, no fumadocs forking.
- One `package.json` at repo root. The Worker has **no own package.json** — wrangler's esbuild resolves `minisearch` from the root `node_modules`. All commands run from repo root.
- Repo has no test runner today; this plan adds root-level vitest. Worker source uses hand-rolled minimal types (no `@cloudflare/workers-types`) so `npm run types:check` keeps passing without tsconfig surgery.

---

### Task 1: Scaffolding — deps, scripts, wrangler config

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `agent-worker/wrangler.toml`
- Create: `agent-worker/.gitignore`

- [ ] **Step 1: Install dependencies**

```bash
npm install minisearch react-markdown
npm install -D wrangler vitest
```

- [ ] **Step 2: Add npm scripts**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"agent:index": "tsx scripts/build-agent-index.ts",
"agent:dev": "wrangler dev -c agent-worker/wrangler.toml",
"agent:deploy": "npm run agent:index && wrangler deploy -c agent-worker/wrangler.toml"
```

- [ ] **Step 3: Create `agent-worker/wrangler.toml`**

```toml
name = "kissflow-docs-agent"
main = "src/index.ts"
compatibility_date = "2026-06-01"

[assets]
directory = "./assets"
binding = "ASSETS"

[vars]
MODEL = "gpt-5-mini"
ALLOWED_ORIGINS = "https://abhiram-kissflow.github.io,http://localhost:3000"

# Cloudflare Rate Limiting binding (open beta). If `wrangler dev` rejects this
# block on the installed wrangler version, comment it out — src/index.ts treats
# the binding as optional.
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 10, period = 60 }
```

- [ ] **Step 4: Create `agent-worker/.gitignore`**

```
assets/chunks.json
.dev.vars
```

(`chunks.json` is a build artifact; `.dev.vars` holds the local OpenAI key.)

- [ ] **Step 5: Verify install + types still pass**

Run: `npm run types:check`
Expected: passes (no new TS files yet).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json agent-worker/wrangler.toml agent-worker/.gitignore
git commit -m "chore: scaffold docs AI agent worker config and deps"
```

---

### Task 2: Index builder — chunk MDX into chunks.json

**Files:**
- Create: `scripts/lib/agent-index.ts` (pure functions — testable)
- Create: `scripts/build-agent-index.ts` (CLI entry)
- Test: `tests/agent-index.test.ts`

The chunk file shape consumed by the Worker:

```ts
// { pages: [{ url, title, text }], chunks: [{ id, url, title, heading, text }] }
```

- [ ] **Step 1: Write the failing test**

Create `tests/agent-index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chunkPage, deriveUrl, stripMdx } from '../scripts/lib/agent-index';

describe('deriveUrl', () => {
  it('maps a regular file to /docs path', () => {
    expect(deriveUrl('build/decision-tables/overview.mdx')).toBe(
      '/docs/build/decision-tables/overview',
    );
  });
  it('maps index files to their directory', () => {
    expect(deriveUrl('build/index.mdx')).toBe('/docs/build');
    expect(deriveUrl('index.mdx')).toBe('/docs');
  });
  it('handles .md extension', () => {
    expect(deriveUrl('build/intro.md')).toBe('/docs/build/intro');
  });
});

describe('stripMdx', () => {
  it('removes imports, exports and JSX tags but keeps text', () => {
    const input = [
      "import { Callout } from 'fumadocs-ui/components/callout';",
      '',
      '<Callout type="info">Tables evaluate top-down.</Callout>',
      '',
      'Plain paragraph stays.',
    ].join('\n');
    const out = stripMdx(input);
    expect(out).not.toContain('import ');
    expect(out).not.toContain('<Callout');
    expect(out).toContain('Tables evaluate top-down.');
    expect(out).toContain('Plain paragraph stays.');
  });
});

describe('chunkPage', () => {
  it('splits content on ## headings, first chunk is intro', () => {
    const body = [
      'Intro text.',
      '',
      '## Evaluation order',
      'Rules run top-down.',
      '',
      '## Tie breaking',
      'First match wins.',
    ].join('\n');
    const chunks = chunkPage({ url: '/docs/dt', title: 'Decision tables', body });
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ id: '/docs/dt#0', heading: '', url: '/docs/dt' });
    expect(chunks[1].heading).toBe('Evaluation order');
    expect(chunks[1].text).toContain('top-down');
    expect(chunks[2].heading).toBe('Tie breaking');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agent-index.test.ts`
Expected: FAIL — cannot resolve `../scripts/lib/agent-index`.

- [ ] **Step 3: Implement `scripts/lib/agent-index.ts`**

```ts
export interface DocChunk {
  id: string;
  url: string;
  title: string;
  heading: string;
  text: string;
}

export interface DocPage {
  url: string;
  title: string;
  text: string;
}

/** content-relative file path -> site-relative docs URL (no basePath). */
export function deriveUrl(relPath: string): string {
  const segments = relPath.replace(/\.mdx?$/, '').split('/');
  if (segments[segments.length - 1] === 'index') segments.pop();
  return ['/docs', ...segments].join('/') || '/docs';
}

/** Strip MDX-isms so chunks contain searchable prose. */
export function stripMdx(body: string): string {
  return body
    .replace(/^(import|export)\s.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Split a page body into per-## -section chunks. Chunk 0 is the intro. */
export function chunkPage(page: { url: string; title: string; body: string }): DocChunk[] {
  const sections = page.body.split(/^## +/m);
  return sections
    .map((section, i) => {
      if (i === 0) return { heading: '', text: section.trim() };
      const newline = section.indexOf('\n');
      const heading = (newline === -1 ? section : section.slice(0, newline)).trim();
      const text = newline === -1 ? '' : section.slice(newline + 1).trim();
      return { heading, text };
    })
    .filter((s) => s.text.length > 0 || s.heading.length > 0)
    .map((s, i) => ({
      id: `${page.url}#${i}`,
      url: page.url,
      title: page.title,
      heading: s.heading,
      text: s.text,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agent-index.test.ts`
Expected: PASS (3 describe blocks, all green).

- [ ] **Step 5: Write the CLI entry `scripts/build-agent-index.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { chunkPage, deriveUrl, stripMdx, type DocChunk, type DocPage } from './lib/agent-index';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const OUT_FILE = path.join(process.cwd(), 'agent-worker', 'assets', 'chunks.json');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.mdx?$/.test(entry.name) ? [full] : [];
  });
}

const pages: DocPage[] = [];
const chunks: DocChunk[] = [];

for (const file of walk(CONTENT_DIR)) {
  const relPath = path.relative(CONTENT_DIR, file).split(path.sep).join('/');
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  const url = deriveUrl(relPath);
  const title = (data.title as string) ?? url;
  const text = stripMdx(content);
  pages.push({ url, title, text });
  chunks.push(...chunkPage({ url, title, body: text }));
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({ pages, chunks }));
console.log(`Wrote ${chunks.length} chunks from ${pages.length} pages to ${OUT_FILE}`);
```

- [ ] **Step 6: Run the script against real content**

Run: `npm run agent:index`
Expected: `Wrote <N> chunks from <M> pages to .../agent-worker/assets/chunks.json` with N > M > 0. Spot-check: `node -e "const d=require('./agent-worker/assets/chunks.json'); console.log(d.pages[0], d.chunks[0])"` — URLs start with `/docs/`, text is prose not JSX.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/agent-index.ts scripts/build-agent-index.ts tests/agent-index.test.ts
git commit -m "feat: add agent index builder chunking MDX content"
```

---

### Task 3: Worker search module

**Files:**
- Create: `agent-worker/src/search.ts`
- Test: `tests/agent-search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/agent-search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSearch } from '../agent-worker/src/search';

const data = {
  pages: [
    { url: '/docs/dt/eval', title: 'Evaluation settings', text: 'Full eval page text.' },
    { url: '/docs/dt/import', title: 'Importing from CSV', text: 'Full import page text.' },
  ],
  chunks: [
    {
      id: '/docs/dt/eval#0',
      url: '/docs/dt/eval',
      title: 'Evaluation settings',
      heading: 'Tie breaking',
      text: 'When two rules match, the first row wins.',
    },
    {
      id: '/docs/dt/import#0',
      url: '/docs/dt/import',
      title: 'Importing from CSV',
      heading: 'Upload',
      text: 'Upload a CSV file to create rows in bulk.',
    },
  ],
};

describe('buildSearch', () => {
  it('finds relevant chunks by content', () => {
    const api = buildSearch(data);
    const hits = api.search('tie breaking rules match');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].url).toBe('/docs/dt/eval');
    expect(hits[0]).toHaveProperty('snippet');
  });

  it('returns page text by url and null for unknown urls', () => {
    const api = buildSearch(data);
    expect(api.getPage('/docs/dt/import')?.text).toBe('Full import page text.');
    expect(api.getPage('/docs/nope')).toBeNull();
  });

  it('caps page text length', () => {
    const big = { pages: [{ url: '/p', title: 'P', text: 'x'.repeat(20000) }], chunks: [] };
    const api = buildSearch(big);
    expect(api.getPage('/p')!.text.length).toBeLessThanOrEqual(8000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agent-search.test.ts`
Expected: FAIL — cannot resolve `../agent-worker/src/search`.

- [ ] **Step 3: Implement `agent-worker/src/search.ts`**

```ts
import MiniSearch from 'minisearch';

export interface ChunksFile {
  pages: { url: string; title: string; text: string }[];
  chunks: { id: string; url: string; title: string; heading: string; text: string }[];
}

export interface SearchHit {
  url: string;
  title: string;
  heading: string;
  snippet: string;
}

export interface SearchApi {
  search(query: string): SearchHit[];
  getPage(url: string): { url: string; title: string; text: string } | null;
}

const MAX_HITS = 8;
const SNIPPET_LEN = 500;
const MAX_PAGE_LEN = 8000;

export function buildSearch(data: ChunksFile): SearchApi {
  const mini = new MiniSearch({
    fields: ['title', 'heading', 'text'],
    storeFields: ['url', 'title', 'heading', 'text'],
  });
  mini.addAll(data.chunks);
  const pagesByUrl = new Map(data.pages.map((p) => [p.url, p]));

  return {
    search(query) {
      return mini
        .search(query, { prefix: true, fuzzy: 0.2, boost: { title: 3, heading: 2 } })
        .slice(0, MAX_HITS)
        .map((hit) => ({
          url: hit.url as string,
          title: hit.title as string,
          heading: hit.heading as string,
          snippet: (hit.text as string).slice(0, SNIPPET_LEN),
        }));
    },
    getPage(url) {
      const page = pagesByUrl.get(url);
      if (!page) return null;
      return { url: page.url, title: page.title, text: page.text.slice(0, MAX_PAGE_LEN) };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agent-search.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent-worker/src/search.ts tests/agent-search.test.ts
git commit -m "feat: add worker search module over chunk index"
```

---

### Task 4: Request validation + CORS helpers

**Files:**
- Create: `agent-worker/src/http.ts`
- Test: `tests/agent-http.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/agent-http.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { corsHeaders, isAllowedOrigin, validateChatRequest } from '../agent-worker/src/http';

const ALLOWED = 'https://abhiram-kissflow.github.io,http://localhost:3000';

describe('isAllowedOrigin', () => {
  it('accepts listed origins, rejects others and null', () => {
    expect(isAllowedOrigin('https://abhiram-kissflow.github.io', ALLOWED)).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000', ALLOWED)).toBe(true);
    expect(isAllowedOrigin('https://evil.example', ALLOWED)).toBe(false);
    expect(isAllowedOrigin(null, ALLOWED)).toBe(false);
  });
});

describe('corsHeaders', () => {
  it('echoes the allowed origin', () => {
    const h = corsHeaders('http://localhost:3000');
    expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(h['Access-Control-Allow-Methods']).toContain('POST');
  });
});

describe('validateChatRequest', () => {
  it('accepts a valid history', () => {
    const result = validateChatRequest({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'how do decision tables work?' },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects non-object, missing messages, bad roles, oversized input', () => {
    expect(validateChatRequest(null).ok).toBe(false);
    expect(validateChatRequest({}).ok).toBe(false);
    expect(validateChatRequest({ messages: [{ role: 'system', content: 'x' }] }).ok).toBe(false);
    expect(
      validateChatRequest({ messages: [{ role: 'user', content: 'x'.repeat(5000) }] }).ok,
    ).toBe(false);
    const tooMany = Array.from({ length: 25 }, () => ({ role: 'user' as const, content: 'q' }));
    expect(validateChatRequest({ messages: tooMany }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agent-http.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `agent-worker/src/http.ts`**

```ts
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4000;

export function isAllowedOrigin(origin: string | null, allowedCsv: string): boolean {
  if (!origin) return false;
  return allowedCsv.split(',').map((s) => s.trim()).includes(origin);
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export type ValidationResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; error: string };

export function validateChatRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Invalid body' };
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return { ok: false, error: 'messages must be a non-empty array of at most 24 items' };
  }
  for (const m of messages) {
    if (
      typeof m !== 'object' ||
      m === null ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string' ||
      m.content.length === 0 ||
      m.content.length > MAX_MESSAGE_CHARS
    ) {
      return { ok: false, error: 'each message needs role user|assistant and content ≤4000 chars' };
    }
  }
  return { ok: true, messages: messages as ChatMessage[] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agent-http.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agent-worker/src/http.ts tests/agent-http.test.ts
git commit -m "feat: add worker request validation and CORS helpers"
```

---

### Task 5: Agent loop with tool calling

**Files:**
- Create: `agent-worker/src/agent.ts`
- Test: `tests/agent-loop.test.ts`

Design: `runAgent` takes injected dependencies (an OpenAI-shaped `callModel` function, the `SearchApi`, and an `emit` callback) so the loop is testable without network or Workers runtime. SSE events emitted:

```ts
// { type: 'status', text } | { type: 'token', text } | { type: 'sources', sources: {url,title}[] }
// | { type: 'done' } | { type: 'error', message }
```

- [ ] **Step 1: Write the failing test**

Create `tests/agent-loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { runAgent, type ModelResponse } from '../agent-worker/src/agent';
import { buildSearch } from '../agent-worker/src/search';

const search = buildSearch({
  pages: [{ url: '/docs/dt/eval', title: 'Evaluation settings', text: 'First row wins on ties.' }],
  chunks: [
    {
      id: '/docs/dt/eval#0',
      url: '/docs/dt/eval',
      title: 'Evaluation settings',
      heading: 'Ties',
      text: 'First row wins on ties.',
    },
  ],
});

function modelScript(responses: ModelResponse[]) {
  let i = 0;
  return async () => responses[i++];
}

describe('runAgent', () => {
  it('runs search -> read -> answer and emits status, tokens, sources, done', async () => {
    const events: unknown[] = [];
    await runAgent({
      messages: [{ role: 'user', content: 'How are ties handled?' }],
      search,
      emit: (e) => void events.push(e),
      callModel: modelScript([
        {
          toolCalls: [
            { id: 'c1', name: 'search_docs', arguments: '{"query":"ties"}' },
          ],
        },
        {
          toolCalls: [
            { id: 'c2', name: 'read_page', arguments: '{"url":"/docs/dt/eval"}' },
          ],
        },
        { content: 'First row wins. See [Evaluation settings](/docs/dt/eval).' },
      ]),
    });

    const types = events.map((e: any) => e.type);
    expect(types.filter((t) => t === 'status').length).toBe(2);
    expect(types).toContain('token');
    const sources = events.find((e: any) => e.type === 'sources') as any;
    expect(sources.sources).toEqual([{ url: '/docs/dt/eval', title: 'Evaluation settings' }]);
    expect(types[types.length - 1]).toBe('done');
  });

  it('forces an answer after max rounds', async () => {
    const events: unknown[] = [];
    const loopForever: ModelResponse = {
      toolCalls: [{ id: 'x', name: 'search_docs', arguments: '{"query":"q"}' }],
    };
    await runAgent({
      messages: [{ role: 'user', content: 'q' }],
      search,
      emit: (e) => void events.push(e),
      callModel: modelScript([
        loopForever,
        loopForever,
        loopForever,
        loopForever,
        loopForever,
        { content: 'Best effort answer.' },
      ]),
    });
    expect((events as any[]).some((e) => e.type === 'token')).toBe(true);
    expect((events as any[]).at(-1)).toEqual({ type: 'done' });
  });

  it('emits error event when the model call throws', async () => {
    const events: unknown[] = [];
    await runAgent({
      messages: [{ role: 'user', content: 'q' }],
      search,
      emit: (e) => void events.push(e),
      callModel: async () => {
        throw new Error('upstream down');
      },
    });
    expect((events as any[]).at(-1).type).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agent-loop.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `agent-worker/src/agent.ts`**

```ts
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
    emit({ type: 'status', text: `Searching docs for “${args.query}”…` });
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agent-loop.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all test files pass.

- [ ] **Step 6: Commit**

```bash
git add agent-worker/src/agent.ts tests/agent-loop.test.ts
git commit -m "feat: add agentic tool-calling loop for docs assistant"
```

---

### Task 6: Worker entry — wiring, OpenAI caller, SSE streaming

**Files:**
- Create: `agent-worker/src/openai.ts`
- Create: `agent-worker/src/index.ts`

No unit tests here — `openai.ts` is a thin fetch wrapper and `index.ts` is runtime wiring; both are covered by the manual `wrangler dev` verification in Step 4. Keep them thin; logic belongs in the tested modules.

- [ ] **Step 1: Implement `agent-worker/src/openai.ts`**

```ts
import { TOOL_DEFINITIONS, type CallModel, type ModelResponse } from './agent';

interface OpenAIChoice {
  message: {
    content: string | null;
    tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  };
}

export function makeOpenAICaller(apiKey: string, model: string): CallModel {
  return async (messages, { allowTools }) => {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_completion_tokens: 1200,
      // Cheap + fast for retrieval-grounded answers. If the API rejects this
      // param for the configured model, delete this line.
      reasoning_effort: 'minimal',
    };
    if (allowTools) {
      body.tools = TOOL_DEFINITIONS;
      body.tool_choice = 'auto';
    }

    let response = await callOnce(apiKey, body);
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1000));
      response = await callOnce(apiKey, body);
    }
    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as { choices: OpenAIChoice[] };
    const message = json.choices[0].message;
    const result: ModelResponse = {};
    if (message.content) result.content = message.content;
    if (message.tool_calls?.length) {
      result.toolCalls = message.tool_calls.map((c) => ({
        id: c.id,
        name: c.function.name,
        arguments: c.function.arguments,
      }));
    }
    return result;
  };
}

function callOnce(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 2: Implement `agent-worker/src/index.ts`**

```ts
import { runAgent, type AgentEvent } from './agent';
import { corsHeaders, isAllowedOrigin, validateChatRequest } from './http';
import { makeOpenAICaller } from './openai';
import { buildSearch, type ChunksFile, type SearchApi } from './search';

// Minimal hand-rolled bindings — intentionally not @cloudflare/workers-types,
// so the root `tsc --noEmit` stays clean without tsconfig changes.
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  OPENAI_API_KEY: string;
  MODEL: string;
  ALLOWED_ORIGINS: string;
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

let searchPromise: Promise<SearchApi> | null = null;

function getSearch(env: Env): Promise<SearchApi> {
  searchPromise ??= env.ASSETS.fetch(new Request('https://assets.local/chunks.json'))
    .then((r) => r.json() as Promise<ChunksFile>)
    .then(buildSearch);
  return searchPromise;
}

function sse(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (url.pathname !== '/chat') return new Response('Not found', { status: 404 });

    if (!isAllowedOrigin(origin, env.ALLOWED_ORIGINS)) {
      return new Response('Forbidden', { status: 403 });
    }
    const cors = corsHeaders(origin!);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response('Rate limited', { status: 429, headers: cors });
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: cors });
    }
    const validated = validateChatRequest(body);
    if (!validated.ok) {
      return new Response(validated.error, { status: 400, headers: cors });
    }

    const search = await getSearch(env);
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    ctx.waitUntil(
      runAgent({
        messages: validated.messages,
        search,
        emit: (event) => void writer.write(encoder.encode(sse(event))),
        callModel: makeOpenAICaller(env.OPENAI_API_KEY, env.MODEL),
      }).finally(() => writer.close()),
    );

    return new Response(readable, {
      headers: {
        ...cors,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
      },
    });
  },
};
```

- [ ] **Step 3: Create local dev secret**

Create `agent-worker/.dev.vars` (gitignored) — ask the user for their OpenAI key, or have them create the file themselves:

```
OPENAI_API_KEY=sk-...
```

- [ ] **Step 4: Manual verification with wrangler dev**

```bash
npm run agent:index   # ensure chunks.json exists
npm run agent:dev     # starts on http://localhost:8787
```

In a second terminal:

```bash
curl -N http://localhost:8787/chat \
  -H 'Origin: http://localhost:3000' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What are decision tables?"}]}'
```

Expected: SSE stream — one or more `status` events, a `token` event with a markdown answer citing `/docs/build/decision-tables/...`, a `sources` event, then `done`.

Also verify rejections:
- No Origin header → HTTP 403.
- `-d '{}'` → HTTP 400.

(If the `[[unsafe.bindings]]` rate-limit block breaks `wrangler dev` on the installed version, comment it out for local dev — the code treats `RATE_LIMITER` as optional — and re-enable for deploy.)

- [ ] **Step 5: Commit**

```bash
git add agent-worker/src/openai.ts agent-worker/src/index.ts
git commit -m "feat: add worker entry with SSE streaming chat endpoint"
```

---

### Task 7: Deploy the Worker

**Files:** none (operational task)

Requires the user's Cloudflare account (free) and OpenAI key. **Pause and coordinate with the user here.**

- [ ] **Step 1: Authenticate wrangler**

User runs interactively (suggest `! npx wrangler login` from the prompt).

- [ ] **Step 2: Set the production secret**

```bash
npx wrangler secret put OPENAI_API_KEY -c agent-worker/wrangler.toml
```

(Prompts for the key; user pastes it.)

- [ ] **Step 3: Deploy**

```bash
npm run agent:deploy
```

Expected: outputs a URL like `https://kissflow-docs-agent.<account>.workers.dev`. Record it — needed in Task 10.

- [ ] **Step 4: Smoke-test production**

```bash
curl -N https://kissflow-docs-agent.<account>.workers.dev/chat \
  -H 'Origin: https://abhiram-kissflow.github.io' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What are decision tables?"}]}'
```

Expected: same SSE stream as local. Then verify 403 without Origin header.

---

### Task 8: Frontend SSE client

**Files:**
- Create: `lib/agent-client.ts`
- Test: `tests/agent-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/agent-client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSSEChunk } from '../lib/agent-client';

describe('parseSSEChunk', () => {
  it('parses complete events and returns the unconsumed remainder', () => {
    const input =
      'data: {"type":"status","text":"Searching…"}\n\n' +
      'data: {"type":"token","text":"Hello"}\n\n' +
      'data: {"type":"tok'; // incomplete
    const { events, rest } = parseSSEChunk(input);
    expect(events).toEqual([
      { type: 'status', text: 'Searching…' },
      { type: 'token', text: 'Hello' },
    ]);
    expect(rest).toBe('data: {"type":"tok');
  });

  it('skips malformed JSON without throwing', () => {
    const { events, rest } = parseSSEChunk('data: not-json\n\ndata: {"type":"done"}\n\n');
    expect(events).toEqual([{ type: 'done' }]);
    expect(rest).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agent-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/agent-client.ts`**

```ts
export type AgentEvent =
  | { type: 'status'; text: string }
  | { type: 'token'; text: string }
  | { type: 'sources'; sources: { url: string; title: string }[] }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { url: string; title: string }[];
}

/** Parse buffered SSE text; returns parsed events and the unconsumed tail. */
export function parseSSEChunk(buffer: string): { events: AgentEvent[]; rest: string } {
  const events: AgentEvent[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith('data: ')) continue;
    try {
      events.push(JSON.parse(line.slice('data: '.length)) as AgentEvent);
    } catch {
      // skip malformed event
    }
  }
  return { events, rest };
}

/** POST the conversation to the agent worker and invoke onEvent per SSE event. */
export async function streamChat(
  agentUrl: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${agentUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (response.status === 429) {
    onEvent({ type: 'error', message: 'Slow down a little — try again in a minute.' });
    return;
  }
  if (!response.ok || !response.body) {
    onEvent({ type: 'error', message: 'The assistant is unavailable — try the search tab.' });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSSEChunk(buffer);
    buffer = rest;
    events.forEach(onEvent);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agent-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent-client.ts tests/agent-client.test.ts
git commit -m "feat: add SSE client for docs agent"
```

---

### Task 9: Chat panel component

**Files:**
- Create: `components/ai-chat.tsx`

UI logic component — verified manually in Task 11 alongside layout integration (no React test infra in this repo; do not add one for this).

- [ ] **Step 1: Implement `components/ai-chat.tsx`**

```tsx
'use client';
import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { streamChat, type AgentEvent, type ChatMessage } from '@/lib/agent-client';
import { cn } from '@/lib/cn';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? 'http://localhost:8787';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function withBasePath(href: string): string {
  return href.startsWith('/') ? `${BASE_PATH}${href}` : href;
}

export default function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput('');
    setBusy(true);
    setStatus('Thinking…');

    const history = [...messages, { role: 'user' as const, content: question }];
    setMessages(history);
    let answer = '';
    let sources: { url: string; title: string }[] = [];

    const apply = (event: AgentEvent) => {
      if (event.type === 'status') setStatus(event.text);
      if (event.type === 'token') {
        answer += event.text;
        setStatus(null);
        setMessages([...history, { role: 'assistant', content: answer, sources }]);
      }
      if (event.type === 'sources') {
        sources = event.sources;
        setMessages([...history, { role: 'assistant', content: answer, sources }]);
      }
      if (event.type === 'error') {
        setStatus(null);
        setMessages([...history, { role: 'assistant', content: event.message }]);
      }
    };

    abortRef.current = new AbortController();
    try {
      await streamChat(
        AGENT_URL,
        history.map(({ role, content }) => ({ role, content })),
        apply,
        abortRef.current.signal,
      );
    } catch {
      apply({ type: 'error', message: 'Connection lost — please try again.' });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="flex h-full max-h-[60vh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-fd-muted-foreground">
            Ask anything about Kissflow — answers come straight from these docs, with sources.
          </p>
        )}
        {messages.map((message, i) => (
          <div
            key={i}
            className={cn(
              'rounded-lg p-3 text-sm',
              message.role === 'user'
                ? 'ml-8 bg-fd-primary/10'
                : 'mr-8 bg-fd-muted text-fd-foreground',
            )}
          >
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => (
                    <a href={withBasePath(href ?? '#')}>{children}</a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
            {message.sources && message.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.sources.map((source) => (
                  <a
                    key={source.url}
                    href={withBasePath(source.url)}
                    className="rounded-full border border-fd-border px-2 py-0.5 text-xs text-fd-muted-foreground hover:bg-fd-accent"
                  >
                    {source.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {status && <p className="animate-pulse text-xs text-fd-muted-foreground">{status}</p>}
      </div>
      <form
        className="flex gap-2 border-t border-fd-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the docs…"
          maxLength={4000}
          className="flex-1 rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fd-primary"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length === 0}
          className="rounded-md bg-fd-primary px-3 py-2 text-sm text-fd-primary-foreground disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
```

Note: `prose` classes only style if Tailwind typography is present — if rendering looks unstyled at verification, drop the `prose` wrapper classes and rely on default element styling; do not add the typography plugin just for this.

- [ ] **Step 2: Type check**

Run: `npm run types:check`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add components/ai-chat.tsx
git commit -m "feat: add AI chat panel component"
```

---

### Task 10: "Ask AI" tab in search dialog + env wiring

**Files:**
- Modify: `components/search.tsx`
- Create: `.env.local` (gitignored, dev only)
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add the tab to `components/search.tsx`**

Replace the file content with:

```tsx
'use client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { create } from '@orama/orama';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import { useState } from 'react';
import AIChat from '@/components/ai-chat';
import { cn } from '@/lib/cn';

function initOrama() {
  return create({
    schema: { _: 'string' },
    // https://docs.orama.com/docs/orama-js/supported-languages
    language: 'english',
  });
}

export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n
  const [mode, setMode] = useState<'search' | 'ai'>('search');
  const { search, setSearch, query } = useDocsSearch({
    type: 'static',
    initOrama,
    locale,
  });

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <div className="flex gap-1 border-b border-fd-border px-3 py-2">
          {(['search', 'ai'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMode(tab)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium',
                mode === tab
                  ? 'bg-fd-primary/10 text-fd-primary'
                  : 'text-fd-muted-foreground hover:text-fd-foreground',
              )}
            >
              {tab === 'search' ? 'Search' : '✦ Ask AI'}
            </button>
          ))}
        </div>
        {mode === 'search' ? (
          <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
        ) : (
          <AIChat />
        )}
      </SearchDialogContent>
    </SearchDialog>
  );
}
```

- [ ] **Step 2: Create `.env.local` for dev**

```
NEXT_PUBLIC_AGENT_URL=http://localhost:8787
```

- [ ] **Step 3: Add the production Worker URL to `.github/workflows/deploy.yml`**

Next to the existing `NEXT_PUBLIC_BASE_PATH: /kissflow-docs` env line, add (using the URL recorded in Task 7 Step 3):

```yaml
NEXT_PUBLIC_AGENT_URL: https://kissflow-docs-agent.<account>.workers.dev
```

- [ ] **Step 4: Manual verification**

With `npm run agent:dev` in one terminal and `npm run dev` in another: open `http://localhost:3000`, hit ⌘K, switch to "✦ Ask AI", ask "What are decision tables?". Expected: status line ("Searching docs…"), then markdown answer with source chips linking into `/docs/build/decision-tables/...`. Search tab still works unchanged.

- [ ] **Step 5: Commit**

```bash
git add components/search.tsx .github/workflows/deploy.yml
git commit -m "feat: add Ask AI tab to search dialog"
```

---

### Task 11: Floating chat launcher on docs pages

**Files:**
- Create: `components/ai-chat-launcher.tsx`
- Modify: `app/docs/layout.tsx` (render the launcher inside the existing layout's children — read the file first; add `<AIChatLauncher />` as a sibling after the docs layout content)

- [ ] **Step 1: Implement `components/ai-chat-launcher.tsx`**

```tsx
'use client';
import { useState } from 'react';
import AIChat from '@/components/ai-chat';

export default function AIChatLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-40 hidden md:block">
      {open && (
        <div className="mb-3 flex h-[480px] w-[380px] flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-background shadow-xl">
          <div className="flex items-center justify-between border-b border-fd-border px-4 py-2">
            <span className="text-sm font-medium">Ask Kissflow Docs</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-fd-muted-foreground hover:text-fd-foreground"
            >
              ✕
            </button>
          </div>
          <AIChat />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Ask AI about the docs"
        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-fd-primary text-fd-primary-foreground shadow-lg hover:opacity-90"
      >
        ✦
      </button>
    </div>
  );
}
```

(Hidden on mobile via `hidden md:block` — small screens keep the search-dialog entry point only.)

- [ ] **Step 2: Mount in `app/docs/layout.tsx`**

Read the file, then add the import and render `<AIChatLauncher />` immediately after the existing layout's children (inside the returned fragment/element):

```tsx
import AIChatLauncher from '@/components/ai-chat-launcher';
// ... existing imports unchanged

// in the JSX, after the existing <DocsLayout …>{children}</DocsLayout> (or equivalent):
// wrap in a fragment if needed:
//   <>
//     <DocsLayout …>{children}</DocsLayout>
//     <AIChatLauncher />
//   </>
```

- [ ] **Step 3: Manual verification**

With both dev servers running: bubble appears bottom-right on `/docs/...` pages (not on home), opens panel, chat works, close button works, dark mode looks right, no overlap with content on a 1280px window.

- [ ] **Step 4: Type check + build**

Run: `npm run types:check && npm run build`
Expected: both pass (build matters — static export must not break).

- [ ] **Step 5: Commit**

```bash
git add components/ai-chat-launcher.tsx app/docs/layout.tsx
git commit -m "feat: add floating AI chat launcher to docs pages"
```

---

### Task 12: Final verification + docs

**Files:**
- Modify: `README.md` (add an "AI agent" section)

- [ ] **Step 1: Full test + build pass**

```bash
npm test && npm run types:check && npm run build
```

Expected: all green.

- [ ] **Step 2: End-to-end against production Worker**

Temporarily set `NEXT_PUBLIC_AGENT_URL` in `.env.local` to the production Worker URL, run `npm run dev`, and ask a question. Expected: works identically (CORS allows localhost). Revert `.env.local` to `http://localhost:8787` afterwards.

- [ ] **Step 3: Document operations in `README.md`**

Append:

```markdown
## AI docs agent

The "Ask AI" assistant is a Cloudflare Worker in `agent-worker/` running an
agentic search loop (OpenAI gpt-5-mini) over a build-time index of `content/`.

- `npm run agent:index` — rebuild the search index from content
- `npm run agent:dev` — run the worker locally (needs `agent-worker/.dev.vars`
  with `OPENAI_API_KEY=...`)
- `npm run agent:deploy` — rebuild index + deploy worker (run after content
  changes so the assistant stays in sync)

The frontend reads the worker URL from `NEXT_PUBLIC_AGENT_URL` (set in
`.github/workflows/deploy.yml` for production, `.env.local` for dev).
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document AI agent operations"
```

---

## Deviations from spec (intentional, minor)

- **Daily per-IP cap (150/day):** Cloudflare's rate-limit binding only supports 10s/60s windows. v1 ships the 10/min limit only; a daily cap needs Durable Objects and is deferred. The 10/min limit plus output-token caps bounds worst-case abuse to acceptable cost.
- **Streaming granularity:** tool rounds are non-streamed; the final answer is emitted as a single `token` event (typically 1–3s after the last tool call). The SSE protocol already supports incremental tokens, so true token streaming is a drop-in Worker-side upgrade later — the client needs no changes.
- **Retry button on SSE disconnect:** spec called for keeping the partial answer plus a retry button. With single-event answers there is no meaningful partial state, so v1 shows an error message instead; the user simply re-asks. Add the button when true token streaming lands.
