# Graph-Grounded RAG Engine

**Date:** 2026-07-10
**Status:** Approved design, not yet implemented
**Scope:** The RAG engine itself — two new grounded-answer API surfaces, a new content knowledge graph, model routing/escalation, citation-forced structured output, abstention. Does **not** cover integrating this engine into the existing floating chat (`AIChat`/`/api/chat`) or building the new Google-AI-Mode-style hero page — both are explicitly deferred to a second, later spec that consumes this engine once it exists.

## Context

The user's original ask was a Google-AI-Mode-style "Ask anything" hero page for `/`, reusing "the same underlying agentic RAG system already in place for the AI chat bot." Investigation during brainstorming found that framing was optimistic about current capability:

- `/api/chat` today does single-shot grounded generation: `searchHelpArticles` (a naive in-process keyword scorer over `content/`, not embeddings, not a graph) finds up to 4 hits, stuffs them into a system prompt, and `streamText` generates one answer. No multi-step tool-calling loop.
- `lib/rag/graph.ts` / `/api/graph/query` exist and expose `searchFrontendGraph`/`searchBackendGraph`, but these are **codebase** graphs (from graphify/codebase-memory-mcp, built for exploring code structure) — not product-content graphs, and not called by the chat flow at all today.
- The project memory referenced "agentic tool-calling loop for docs assistant" and "graph-backed retrieval" work — that was built on a Cloudflare Worker (`agent-worker/`) that was later reverted from this repo. It doesn't exist in the live system.
- `/` (the site root) currently does nothing but a client-side redirect to `/docs/get-started` — there is no real landing page today.

Partway through designing the hero page, the user introduced a firmer architectural requirement — not just "reuse what exists," but a specific standard for how grounding should work: **retrieve and constrain graph results first, pass only relevant nodes/edges plus source snippets, require citations to those IDs, and have the model say it cannot establish an answer when the retrieved evidence is insufficient** — plus a three-model routing scheme (`gpt-5.6-luna` default, `gpt-5.6-terra` escalation for complex synthesis, `gpt-5.3-codex` for developer-facing graph-query generation).

This is real, standalone infrastructure — both the future hero page and the existing floating chat would consume it — so the project was split into two specs. This document covers the engine only.

**Model identifiers used in this spec were verified against OpenAI's own model docs during brainstorming** (not assumed from training data — GPT-5.6 shipped 2026-07-09, after this assistant's knowledge cutoff):
- `gpt-5.6-luna` — fastest/cheapest tier, 1,050,000 token context, supports function calling, tool calling, structured outputs.
- `gpt-5.6-terra` — balanced tier, same context window and capabilities, higher cost/capability than Luna.
- `gpt-5.3-codex` — OpenAI's current most-capable agentic coding model, used here for developer-facing graph-query generation.

## Architecture

Two independent API surfaces, sharing one core module for context-constraining, citation schema, abstention, and escalation logic — not one engine with a runtime classifier deciding which mode a question belongs to. The two surfaces have different callers (public hero page/chat vs. internal developer tooling), so routing between them is a deployment/caller decision, not something this engine decides per-request.

- **End-user path** (`app/api/rag/ask/route.ts`): grounds answers in a **new content knowledge graph** built over `content/` (586 MDX articles) — nodes for articles/sections/concepts, edges for cross-references and relationships. Query → embed → semantic seed search over a bundled vector index → bounded graph traversal from seed nodes to build a constrained subgraph (nodes/edges + source snippets) → Luna (default) or Terra (escalated) generates a structured, citation-required answer against *only* that constrained context.
- **Developer path** (`app/api/rag/dev-ask/route.ts`): grounds answers in the **existing** codebase graph (`lib/rag/graph.ts`, untouched). Query → `gpt-5.3-codex` generates a structured query against `searchFrontendGraph`/`searchBackendGraph` → same constrain/escalate/cite/abstain contract → Luna or Terra answers. Access-controlled the same way `/api/graph/query` already is (API key + origin check), not reachable from the public site.
- **Content knowledge graph**: built via `graphify` (this user's existing standard tool for "any input to knowledge graph," per global CLAUDE.md) against `content/`. Built and committed as static artifacts, not generated per-request or per-deploy — re-run manually/on a schedule when content changes meaningfully, mirroring the existing `refresh-kissflow-graphs.sh` pattern used for the separate XG project's graphs.
- **Vector index**: embeddings for every content-graph node, pre-computed at graph-build time, bundled as a static file, loaded into memory once at cold start (singleton cache, same pattern `lib/rag/help.ts` already uses). No new hosted database — verified the corpus (586 articles, 3.7MB) is small enough that a brute-force in-memory cosine-similarity search is entirely adequate; a hosted vector DB would be unjustified infrastructure at this scale.

## Components

**Content graph build (offline, not per-request):**
- `scripts/build-content-graph.ts` — runs graphify against `content/`, then an embedding pass (`embed`/`embedMany` from the `ai` SDK, OpenAI embedding model) over every resulting node. Outputs committed artifacts: `lib/rag/content-graph/graph.json` (nodes/edges), `lib/rag/content-graph/embeddings.json` (vectors) — same "generate once, commit, don't rebuild on every deploy" pattern as `public/openapi/kissflow-api.json` in the earlier API-reference work.

**Shared core (used by both API surfaces):**
- `lib/rag/content-graph.ts` — loads the committed graph + embeddings into memory once; exposes `seedSearch(queryEmbedding, k)` (cosine similarity top-k) and `constrainSubgraph(seedNodeIds, maxNodes)` (bounded traversal).
- `lib/rag/escalation.ts` — turns the qualitative escalation triggers ("multi-hop reasoning, ambiguity resolution, conflicting evidence, broad synthesis") into concrete, checkable signals rather than vibes:
  - **Multi-hop**: traversal needed more than 1 hop from every seed node to reach citation-worthy content.
  - **Ambiguity**: top seed-similarity scores cluster within a narrow band across semantically distinct nodes (i.e. the seed search itself couldn't confidently pick a single best match).
  - **Broad synthesis**: the constrained context spans more than N distinct source articles (N to be tuned during implementation against real queries).
  - Escalates to Terra if any signal fires; stays on Luna otherwise.
- `lib/rag/citation-schema.ts` — Zod schema: `{ answer: string, citations: Array<{ nodeId: string, snippet: string }>, insufficientEvidence: boolean }`. Enforced via the AI SDK's structured-output support using `streamObject` (not `streamText`) — the citation/abstention contract is structural, not something the model can be merely asked to follow in prose, but the object still streams incrementally so this doesn't sacrifice a responsive UX for whatever eventually consumes it.
- `lib/rag/model-router.ts` — resolves the escalation decision to `openai('gpt-5.6-luna')` or `openai('gpt-5.6-terra')`.

**API surfaces:**
- `app/api/rag/ask/route.ts` — end-user path, as described in Architecture.
- `app/api/rag/dev-ask/route.ts` — developer path, as described in Architecture. Reuses the existing `/api/graph/query` auth pattern (`GRAPH_QUERY_API_KEY`-style bearer token + origin check) rather than inventing new auth.

**Explicitly untouched by this spec:** `/api/chat`, `AIChat`, `AIChatLauncher`, `lib/rag/help.ts`, `lib/rag/graph.ts` (consumed, not modified), `/api/graph/query`. Swapping the existing chat's retrieval for this new engine, and building the hero page UI, are the second spec's concern.

## Data flow

**End-user path:**
```
POST /api/rag/ask { query }
  → embed(query) via OpenAI embedding model
  → content-graph.seedSearch(queryEmbedding, k) — top-k nodes by cosine similarity
  → escalation.assess() checks similarity-score clustering (ambiguity signal)
  → content-graph.constrainSubgraph(seedNodeIds, maxNodes) — bounded traversal;
    escalation.assess() re-checked against traversal depth (multi-hop) and
    distinct-source-article count (broad synthesis)
  → model-router picks Luna or Terra based on the (possibly updated) escalation decision
  → streamObject({ model, schema: citationSchema, context: constrainedSubgraph + snippets })
  → response streams { answer, citations[], insufficientEvidence }
```

**Developer path:**
```
POST /api/rag/dev-ask { query }  [API key required, same pattern as /api/graph/query]
  → gpt-5.3-codex generates a structured query object (source: frontend/backend/both, terms, limit)
  → execute against searchFrontendGraph / searchBackendGraph (existing, unchanged)
  → escalation.assess() on the result set (same signals as end-user path)
  → model-router picks Luna or Terra
  → streamObject(...) with the same citationSchema
  → response streams { answer, citations[], insufficientEvidence }
```

No live consumer exists for either endpoint at the end of this project — both are directly testable (curl/Playwright against the routes) without a UI. Real consumption (hero page, and/or swapping `/api/chat`'s retrieval) is the second spec's job.

## Error handling

- **`insufficientEvidence: true` is not an error** — it's the expected, correct output when the constrained subgraph doesn't support a confident answer. This is the entire point of the abstention requirement; callers must render it as an honest "not enough information," never suppress or paper over it.
- **Embedding/graph-load failure at cold start**: `content-graph.ts`'s singleton loader throws if the committed `graph.json`/`embeddings.json` are missing or malformed — fails loudly on first request rather than silently falling back to ungrounded generation, which would defeat the citation requirement entirely.
- **Zero seed results** (query embedding matches nothing above a similarity floor): short-circuits straight to `insufficientEvidence: true` without calling Luna/Terra at all — cheaper and more honest than asking a model to reason over an empty context.
- **Codex query-generation failure or a malformed generated query** (dev path): fails the request with a clear error rather than falling back to an unconstrained/unfiltered graph dump — an ungoverned dev-path query against the full codebase graph could be large and slow, and silently widening scope on failure is exactly the kind of "confident but ungrounded" behavior this design exists to prevent.
- **Escalated-to-Terra still insufficient**: surfaces `insufficientEvidence: true` from Terra directly — there is no tier above Terra in this design, so the engine must be honest about hitting its ceiling rather than loop or fabricate.

## Testing

- No test runner in this repo (established convention). `lib/rag/escalation.ts` is the one module with real, pure branching logic worth a `node:test` unit test (same TDD pattern as the auth-normalization function in the earlier API-reference work): given synthetic seed-result/subgraph fixtures, assert Luna vs. Terra routing lands correctly for each signal (multi-hop, ambiguity, broad synthesis) independently and in combination.
- `scripts/build-content-graph.ts`: manual verification — run it, confirm `graph.json`/`embeddings.json` are produced, spot-check a handful of nodes against real content for sanity.
- Both API routes: manual verification via curl/Playwright — real questions against `/api/rag/ask`, confirming citations resolve to real doc URLs and that `insufficientEvidence` correctly fires on an out-of-scope question; a real developer question against `/api/rag/dev-ask` with the API key, confirming the codex-generated query and resulting citations make sense.

## Explicitly out of scope

- The hero page UI (`/`, "Ask anything" experience, sources rail, persona cards) — a separate, later spec that consumes `/api/rag/ask` once it exists.
- Swapping `/api/chat`'s current keyword-search retrieval for this engine — also the later spec's concern; `/api/chat` and `AIChat` are untouched here.
- Any runtime classifier deciding end-user vs. developer intent — the two paths are separate API surfaces with separate callers, decided by deployment/consumer, not by this engine at request time.
- Anything above the Luna/Terra two-tier escalation (e.g. a third tier, human handoff) — out of scope until real usage shows the two-tier ceiling is insufficient.
