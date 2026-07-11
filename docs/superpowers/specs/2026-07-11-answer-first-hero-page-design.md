# Answer-First Hero Page

**Date:** 2026-07-11
**Status:** Approved design
**Scope:** Sub-project 2 of 2 — the Google-AI-Mode-style "Ask anything" landing page at `/`, consuming the graph-grounded RAG engine (`/api/rag/ask`) shipped in sub-project 1.

## Context
`/` currently is `app/(home)/page.tsx` — a client redirect to `/docs/get-started`. The RAG engine is live: `POST /api/rag/ask {query}` → `{ answer, citations: [{nodeId, snippet}], insufficientEvidence }` (plain JSON, non-streaming; `nodeId` is the doc URL). The floating `AIChatLauncher` is mounted only in `docs/layout.tsx`, so it is already absent on `/` — nothing to suppress. `components/persona-nav.tsx` exports a propless `PersonaNav` (the 4 persona cards already used on /docs/get-started).

## Decisions (this session)
- **Single-shot Q&A**, not multi-turn — the engine takes one query with no history. Re-asking replaces the previous answer.
- **Whole answer after a loading state**, not token streaming — the engine returns the answer as one object (the installed SDK hangs on gpt-5.6 structured-output streaming). Streaming is a documented follow-up.

## Architecture
Replace the redirect in `app/(home)/page.tsx` with the hero. Keep `(home)/layout.tsx` (gives the top nav). The hero is a client component using plain `fetch` + `useState` (no `useChat`). Persona cards render below the box always.

## Components
- **`app/(home)/page.tsx`** — server shell: renders `<HeroAsk />` + `<PersonaNav />` below it.
- **`components/hero-ask.tsx`** (new, client) — big "Ask anything" input; on submit POSTs `{query}` to `/api/rag/ask`, shows a loading indicator, then renders the result. `useState` for query / loading / result / error. Re-ask replaces. Answer rendered as markdown (react-markdown, already a dep — reuse the `MarkdownMessage` pattern from `components/ai-chat.tsx`). Sources rail: dedup `citations` by `nodeId`, render each as a card linking to the `nodeId` URL.
- **Reuse:** `components/persona-nav.tsx` (`PersonaNav`), unchanged.

## Data flow
```
/ → empty state: centered "Ask anything" input + persona cards below
 → submit query → POST /api/rag/ask {query} → loading
 → response:
     insufficientEvidence || empty answer → "couldn't find that in the docs" note + persona cards
     else → markdown answer + sources rail (deduped citation URLs as links)
```

## Error handling
- `/api/rag/ask` non-200 (500 missing key / model error, 400 bad query) → friendly "assistant is unavailable right now — browse the docs below" state, never a hung spinner.
- `insufficientEvidence: true` → honest "I couldn't find that in the Kissflow docs" (the engine's abstention surfacing correctly), with persona cards to browse.
- Query < 2 chars → submit disabled (matches the route's own min-length guard).

## Out of scope
Multi-turn conversation, token streaming, voice/attachments/slash-commands (the floating chat keeps those; the hero is a focused ask box), any change to `/api/rag/ask` or the engine.

## Verification
No test runner in repo. Build + Playwright walkthrough against the live engine (dev server + `.env.local` key): load `/`, ask a real question, confirm a grounded answer + working source links render; ask an out-of-scope question, confirm the abstention state; confirm persona cards link correctly.
