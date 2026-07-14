# Trustworthy Media RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both the hero assistant and floating chat widget accurate, evidence-grounded, appropriately detailed answers with validated citations and contextual source media.

**Architecture:** Build one section-level content index and one shared RAG service. Both `/api/rag/ask` and `/api/chat` call it, then adapt its validated result to their existing streaming formats. React clients render only validated cited sources and model-selected source media.

**Tech Stack:** TypeScript, Next.js App Router, AI SDK v6, Zod v4, Node test runner, React, gray-matter.

---

## File structure

- `lib/rag/content-sections.ts`: pure section and media extraction from MDX.
- `lib/rag/content-sections.test.ts`: parser regression tests.
- `scripts/build-content-graph.ts`: section-node and embedding artifact builder.
- `lib/rag/content-graph.ts`: direct semantic section retrieval and source grouping.
- `lib/rag/grounding.ts`: citation/media validation boundary.
- `lib/rag/grounding.test.ts`: validation regression tests.
- `lib/rag/ask-service.ts`: shared retrieval, user-only history, generation, and validation orchestration.
- `lib/rag/ask-service.test.ts`: shared service tests used by both APIs.
- `app/api/rag/ask/route.ts`: hero HTTP/streaming adapter.
- `app/api/chat/route.ts`: chat-widget HTTP/streaming adapter.
- `components/rag-media.tsx`: safe responsive image/video evidence renderer.
- `components/hero-ask.tsx`, `components/ai-chat.tsx`: client adapters.
- `lib/rag/evals/cases.json`, `scripts/evaluate-rag.ts`: reproducible release evaluation.

### Task 1: Parse source sections and contextual media

**Files:**
- Create: `lib/rag/content-sections.ts`
- Create: `lib/rag/content-sections.test.ts`

- [ ] **Step 1: Write the failing section-extraction tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractContentSections } from './content-sections';

test('keeps child-table instructions and their image in one section', () => {
  const chunks = extractContentSections({
    url: '/docs/build/forms/creating-a-form',
    title: 'Creating a form',
    body: 'Intro\n\n## Child tables\nClick **Add table**.\n\n![Add table](/migration-assets/table.png)\n\n## CSV\nImport rows.',
  });
  assert.deepEqual(chunks.map((chunk) => chunk.anchor), ['', 'child-tables', 'csv']);
  assert.match(chunks[1].text, /Add table/);
  assert.deepEqual(chunks[1].media, [{ id: 'child-tables-media-1', kind: 'image', url: '/migration-assets/table.png', alt: 'Add table' }]);
});

test('keeps a Vimeo iframe with its owning section', () => {
  const chunks = extractContentSections({ url: '/docs/a', title: 'A', body: '## Watch\n<iframe src="https://player.vimeo.com/video/123"></iframe>' });
  assert.equal(chunks[0].media[0].kind, 'video');
  assert.equal(chunks[0].media[0].url, 'https://player.vimeo.com/video/123');
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npx tsx --test lib/rag/content-sections.test.ts`

Expected: FAIL because `content-sections.ts` is absent.

- [ ] **Step 3: Implement the minimum parser**

```ts
export type SourceMedia = { id: string; kind: 'image' | 'video'; url: string; alt: string; title?: string };
export type ContentSection = { anchor: string; heading: string; text: string; media: SourceMedia[] };

export function extractContentSections(input: { url: string; title: string; body: string }): ContentSection[] {
  // Split on h2 headings, derive unique slug anchors, strip MDX imports and
  // components from prose, and extract Markdown/HTML images plus video embeds
  // and links into the section that contains them.
}
```

Do not truncate section text. Do not include media URLs in the embedding text.

- [ ] **Step 4: Verify the tests pass**

Run: `npx tsx --test lib/rag/content-sections.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rag/content-sections.ts lib/rag/content-sections.test.ts
git commit -m "feat: extract documentation sections and media"
```

### Task 2: Replace page snippets with direct section retrieval

**Files:**
- Modify: `scripts/build-content-graph.ts`
- Modify: `lib/rag/content-graph.ts`
- Modify: `lib/rag/content-graph.test.ts`

- [ ] **Step 1: Write failing retrieval tests**

```ts
test('rankSections returns the answer-bearing child-table section first', () => {
  const hits = rankSections([1, 0], 1, graph, vectors);
  assert.deepEqual(hits.map((hit) => hit.nodeId), ['/docs/form#child-tables']);
});

test('groupSources emits one article source for multiple cited sections', () => {
  assert.deepEqual(groupSources([childTables, csv]), [{ title: 'Creating a form', url: '/docs/form' }]);
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx tsx --test lib/rag/content-graph.test.ts`

Expected: FAIL because `rankSections` and `groupSources` are absent.

- [ ] **Step 3: Implement section nodes**

Extend `GraphNode` with `articleUrl`, `heading`, `anchor`, and `media`.
Use `extractContentSections` inside the graph builder and create one graph
node per returned section. Embed exactly:

```ts
`${node.label}\n${node.heading}\n${node.snippet}`
```

Expose `rankSections(queryVector, k, graph, vectors)` as the cosine-ranked
top-k list. Keep `seedSearch` as a compatibility alias only. Add
`groupSources(nodes)`, preserving first-citation order while deduplicating by
`articleUrl`.

- [ ] **Step 4: Verify tests pass**

Run: `npx tsx --test lib/rag/content-graph.test.ts`

Expected: PASS.

- [ ] **Step 5: Rebuild artifacts**

Run: `npx tsx scripts/build-content-graph.ts graphify-out/graph.json`

Expected: the artifact has more nodes than the current article-level graph and
contains `/docs/build/forms/creating-a-form#child-tables`.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-content-graph.ts lib/rag/content-graph.ts lib/rag/content-graph.test.ts lib/rag/content-graph/graph.json lib/rag/content-graph/embeddings.json
git commit -m "feat: index documentation by section"
```

### Task 3: Enforce citations and media selections

**Files:**
- Modify: `lib/rag/citation-schema.ts`
- Modify: `lib/rag/answer.ts`
- Create: `lib/rag/grounding.ts`
- Create: `lib/rag/grounding.test.ts`

- [ ] **Step 1: Write failing validation tests**

```ts
test('abstains when a non-empty answer has no valid citation', () => {
  const result = validateGroundedAnswer({ answer: 'Use Add table.', citations: [{ nodeId: 'missing', snippet: 'x' }], media: [], insufficientEvidence: false }, [childSection]);
  assert.deepEqual(result, { answer: '', citations: [], media: [], insufficientEvidence: true });
});

test('retains source media only when it belongs to a cited section', () => {
  const result = validateGroundedAnswer(validChildTableAnswer, [childSection]);
  assert.deepEqual(result.media, [{ nodeId: 'child', mediaId: 'child-media-1' }]);
});
```

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test lib/rag/grounding.test.ts`

Expected: FAIL because `validateGroundedAnswer` is absent.

- [ ] **Step 3: Add contract, prompt rules, and validator**

Add `media: z.array(z.object({ nodeId: z.string(), mediaId: z.string() }))`
to the citation schema. Implement `validateGroundedAnswer` to retain only
citations whose ID exists and whose exact snippet occurs in that section, then
retain only unique media selected from one of those cited sections. A non-empty
answer with no valid citations becomes a clean abstention.

Update the system rules: direct questions stay concise; procedural or complex
questions receive complete evidence-backed detail; there is no arbitrary output
limit; unsupported claims and decorative media are prohibited.

- [ ] **Step 4: Verify passing tests**

Run: `npx tsx --test lib/rag/grounding.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rag/citation-schema.ts lib/rag/answer.ts lib/rag/grounding.ts lib/rag/grounding.test.ts
git commit -m "feat: validate RAG citations and media"
```

### Task 4: Share safe retrieval and conversational context across both APIs

**Files:**
- Create: `lib/rag/ask-service.ts`
- Create: `lib/rag/ask-service.test.ts`
- Modify: `app/api/rag/ask/route.ts`
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Write failing service tests**

```ts
test('uses the prior user question, not prior assistant prose, for a follow-up', async () => {
  const result = await askFromRag({ query: 'How do I create one?', history: [{ role: 'assistant', content: 'unsupported fact' }, { role: 'user', content: 'What is a child table?' }], deps });
  assert.match(deps.embedValues[0], /What is a child table/);
  assert.doesNotMatch(result.modelMessages.map((m) => String(m.content)).join('\n'), /unsupported fact/);
});

test('returns sidebar sources only from validated citations', async () => {
  const result = await askFromRag({ query: 'Create a child table', history: [], deps });
  assert.deepEqual(result.sources, [{ title: 'Creating a form', url: '/docs/build/forms/creating-a-form' }]);
});
```

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test lib/rag/ask-service.test.ts`

Expected: FAIL because the shared service is absent.

- [ ] **Step 3: Implement the shared service**

`askFromRag` accepts `query`, typed history, and injected embedding,
retrieval, and generation dependencies. It combines only the latest prior user
turn with the current question for retrieval, ranks `TOP_K = 8` sections
directly, sends only user history to the model, validates the structured model
object, and derives sources from validated citations.

Both routes call this service. Keep each existing route's response protocol:
`/api/rag/ask` returns its structured stream; `/api/chat` converts the
validated answer to the existing UI-message stream. Neither route exposes
unvalidated retrieved nodes as sources.

- [ ] **Step 4: Verify tests pass**

Run: `npx tsx --test lib/rag/ask-service.test.ts lib/rag/grounding.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rag/ask-service.ts lib/rag/ask-service.test.ts app/api/rag/ask/route.ts app/api/chat/route.ts
git commit -m "fix: share grounded RAG across assistants"
```

### Task 5: Render cited source media in both assistant surfaces

**Files:**
- Create: `components/rag-media.tsx`
- Create: `components/rag-media.test.tsx`
- Modify: `components/hero-ask.tsx`
- Modify: `components/ai-chat.tsx`

- [ ] **Step 1: Write failing render tests**

```tsx
test('renders a source image with its documented alt text', () => {
  render(<RagMedia media={{ kind: 'image', url: '/migration-assets/table.png', alt: 'Add table button' }} />);
  assert.equal(screen.getByRole('img', { name: 'Add table button' }).getAttribute('src'), '/migration-assets/table.png');
});

test('links to unapproved video providers instead of embedding them', () => {
  render(<RagMedia media={{ kind: 'video', url: 'https://example.invalid/demo', alt: 'Demo' }} />);
  assert.equal(screen.getByRole('link', { name: /watch demo/i }).getAttribute('href'), 'https://example.invalid/demo');
});
```

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test components/rag-media.test.tsx`

Expected: FAIL because `RagMedia` is absent.

- [ ] **Step 3: Implement media and client adapters**

`RagMedia` renders trusted images responsively, embeds only Vimeo/YouTube
hosts via an aspect-ratio iframe, and links every other video externally. Never
render raw MDX/HTML. Extend both assistant turn/message representations with
validated media and render all unique selected assets below the associated
answer. The hero sidebar and widget sources must consume cited sources only.

- [ ] **Step 4: Verify passing tests**

Run: `npx tsx --test components/rag-media.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/rag-media.tsx components/rag-media.test.tsx components/hero-ask.tsx components/ai-chat.tsx
git commit -m "feat: show cited documentation media in assistants"
```

### Task 6: Establish the evaluation and release gate

**Files:**
- Create: `lib/rag/evals/cases.json`
- Create: `lib/rag/evals.test.ts`
- Create: `scripts/evaluate-rag.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing benchmark tests**

```ts
test('child-table setup retrieves the builder section', async () => {
  const result = await evaluateRetrieval(childTableCase);
  assert.ok(result.topKIds.includes('/docs/build/forms/creating-a-form#child-tables'));
});

test('unsupported queries are labelled for abstention', async () => {
  const result = await evaluateRetrieval(unsupportedCase);
  assert.equal(result.case.shouldAbstain, true);
});
```

- [ ] **Step 2: Verify failure**

Run: `npx tsx --test lib/rag/evals.test.ts`

Expected: FAIL because the corpus and evaluator are absent.

- [ ] **Step 3: Implement corpus and runner**

Create at least 50 cases covering setup, procedures, SDK, mobile, analytics,
media, follow-ups, and unsupported questions. Each answerable case carries one
or more exact expected section IDs; unsupported cases set
`shouldAbstain: true`. Add `rag:eval`:

```json
"rag:eval": "npx tsx scripts/evaluate-rag.ts"
```

The runner writes `bench/rag-results.json` with top-k recall, failures, and
per-case evidence IDs. A critical case failing is a release blocker.

- [ ] **Step 4: Verify the gate**

Run: `npx tsx --test lib/rag/evals.test.ts && npm run rag:eval`

Expected: PASS and a results file that includes the child-table case.

- [ ] **Step 5: Commit**

```bash
git add lib/rag/evals/cases.json lib/rag/evals.test.ts scripts/evaluate-rag.ts package.json bench/rag-results.json
git commit -m "test: gate RAG rollout on documented evidence"
```

### Task 7: Verify both public assistant experiences

**Files:** none

- [ ] **Step 1: Run all automated checks**

Run: `npm test && npm run types:check && npm run build`

Expected: all commands exit 0.

- [ ] **Step 2: Verify hero response**

Run: `curl -s -X POST http://localhost:3000/api/rag/ask -H 'content-type: application/json' -d '{"query":"How do I create child tables in Kissflow?"}'`

Expected: the response describes **Add table**, cites
`creating-a-form#child-tables`, and selects only media from that cited
section.

- [ ] **Step 3: Verify chat-widget response**

Open the widget and submit the same question, then a follow-up: “How do I
create one?”.

Expected: both answers use the child-table builder evidence; neither reuses
unsupported earlier assistant prose; the widget shows the same cited media as
the hero when it is selected.

- [ ] **Step 4: Verify abstention**

Run: `curl -s -X POST http://localhost:3000/api/rag/ask -H 'content-type: application/json' -d '{"query":"Can Kissflow host my Kubernetes cluster?"}'`

Expected: `insufficientEvidence: true` with no answer, citations, or media.

- [ ] **Step 5: Commit benchmark evidence**

```bash
git add bench/rag-results.json
git commit -m "test: record trusted RAG benchmark"
```
