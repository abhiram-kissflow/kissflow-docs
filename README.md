# kissflow-docs

The Kissflow product documentation site: 588 English help articles (plus a full Spanish
machine translation), an embedded REST API reference, a live roadmap and pre-release
board, and a graph-grounded "Ask AI" answer engine that answers from the docs corpus
with citations.

Built on [Fumadocs](https://fumadocs.dev) + Next.js 16 (App Router, React 19).
It ships two ways from one codebase: a fully static export to GitHub Pages, and a
dynamic deployment (Vercel) where the API routes and the AI features actually run.

- Static mirror: https://abhiram-kissflow.github.io/kissflow-docs/
- Source of truth for content: `content/**` (MDX)
- Product intent and design principles: [`PRODUCT.md`](PRODUCT.md)
- Active feature PRD (localization): [`PRD.md`](PRD.md)
- Per-feature plans and design specs: [`docs/superpowers/`](docs/superpowers/). One
  dated plan plus design spec per feature (the AI agent, the RAG engine, the API
  reference, the theme, the coachmark). Read these before touching a feature; they carry
  the reasoning that the code does not.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

`npm run dev` and `npm run build` both run with `--webpack` (not Turbopack).

### Environment variables

Put these in `.env.local` (gitignored). Writing and validating content needs none of
them. `OPENAI_API_KEY` is what turns the AI surfaces on locally.

| Variable | Required for | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | Ask AI (hero + chat), translation script, graph rebuilds | Pure content work needs no keys at all. Without it, `/api/rag/ask` and `/api/chat` return 500; everything else still builds. |
| `GRAPH_QUERY_API_KEY` | `/api/graph/query`, `/api/rag/dev-ask` | Bearer key for the developer graph endpoints. **Unset means no key is required at all**, not that the routes are closed. Set it on any public deployment. |
| `GRAPH_QUERY_ALLOWED_ORIGINS` | same two routes | Comma-separated origin allowlist. Empty falls back to same-origin, which still permits the site's own pages. |
| `NEXT_PUBLIC_BASE_PATH` | static export | Set to `/kissflow-docs` by CI, because Pages serves under a subpath. Setting it implies `output: 'export'`. |
| `STATIC_EXPORT` | static export | `true` forces static export at the domain root. Use this one to reproduce a static build locally; use the base path only when mimicking Pages. |
| `OPENAI_MODEL` | nothing today | Only read by `lib/bot.ts`, which is currently not imported anywhere. See [Dead code](#known-constraints-and-gotchas). |

Local Node version: CI builds on Node 21. Nothing pins it locally, so match 21 or
newer.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server. |
| `npm run build` | Production build. Static export when `NEXT_PUBLIC_BASE_PATH` or `STATIC_EXPORT` is set. |
| `npm start` | Serves the static `out/` directory (`serve out`). Not a Next server, and it does nothing useful unless your last build was a static one. |
| `npm run validate` | Validates every MDX file's frontmatter against `lib/frontmatter.ts`. Run before pushing content. |
| `npm run types:check` | `fumadocs-mdx` + `next typegen` + `tsc --noEmit`. |
| `npm test` | Node test runner over `lib/theme.test.ts` and `lib/rag/**/*.test.ts` only. |
| `npm run migrate` | Forumbee HTML to MDX conversion (migration tooling). |
| `npm run redirects` | Prints redirect JSON to stdout from `scripts/url-mapping.csv`. That CSV is not in the repo; you create it (`oldSlug,newPath`) and paste the output where you need it. |
| `npm run openapi:convert` | Postman collection to OpenAPI draft. |
| `npm run openapi:normalize-auth` | Rewrites auth to the two-header Kissflow scheme. |
| `npm run openapi:lint` | `redocly lint` over `public/openapi/kissflow-api.json`. |
| `npm run graph:list` / `graph:project` / `graph:payload` | Local authoring aid only. Builds request payloads for a code-graph MCP server pointed at checkouts of the Kissflow application repos on your own machine. Nothing at runtime uses it, and it will not work without those checkouts. |

---

## Working in this repo

There is no CONTRIBUTING file and no enforced review. The convention visible in the
history is a `feat/*` or `fix/*` branch merged into `main`; `main` is what deploys.

### Editing an existing article

1. Edit the English `.mdx` under `content/`.
2. Decide about Spanish. The `.es.mdx` sibling does not update itself, and nothing in CI
   flags an English edit whose translation went stale. Re-run
   `node scripts/translate-docs.mjs --locale es --changed` to catch it (that mode
   re-translates any file newer than its sibling), or leave it and accept the drift.
3. `npm run validate`.
4. Merge to `main`.

### Adding a new article

1. Create `content/<section>/<folder>/<slug>.mdx`. The file path is the URL: the page
   serves at `/docs/<section>/<folder>/<slug>`, and `index.mdx` serves the folder root.
2. Write valid frontmatter (see [Frontmatter contract](#frontmatter-contract)).
   `npm run validate` fails the build if it is wrong.
3. Add the slug to the folder's `meta.json` `pages` array. Without it the page still
   builds and is still reachable by URL, but it does not appear in the sidebar.
4. Translate: `node scripts/translate-docs.mjs --locale es --files "content/<section>/**"`.
   This also produces the matching `meta.es.json`.
5. Rebuild the RAG graph if you want Ask AI to find it (see below). Until then the
   article exists on the site but is invisible to the answer engine.
6. `npm run validate`, then merge.

### Refreshing the answer engine after a content batch

The graph and embeddings are committed artifacts, so new or renamed articles are
invisible to Ask AI until you regenerate and commit them. Order:

1. `npx tsx scripts/build-content-graph.ts` (the canonical builder; it calls the
   embedding model, so `OPENAI_API_KEY` must be set).
2. `npx tsx scripts/enrich-graph-edges.ts` to densify cross-link edges. Skipping this
   leaves the 2-hop expansion returning mostly isolated seeds.
3. `npx tsx scripts/ingest-openapi-graph.ts` and `npx tsx scripts/ingest-sdk-graph.ts`
   to re-add API operations and SDK methods, which live outside `content/`.
4. Commit `lib/rag/content-graph/graph.json` and `embeddings.json`. The embeddings file
   is 28 MB, so this is a large, unreviewable diff every time.

`build-content-graph-direct.ts` is the no-LLM variant: it derives the same node and edge
structure straight from MDX cross-links, without embeddings. Useful for inspecting graph
shape, not a substitute for step 1.

There is no eval harness in the repo. The thresholds in `lib/rag/escalation.ts` cite a
13-query benchmark that is not checked in, so "did the rebuild help" is a manual judgment.

### Adding a locale

`scripts/translate-docs.mjs` already accepts `es`, `fr`, `de`, and `it`. The script is
only part of the job:

1. Add the locale to `languages` in `lib/i18n.ts` and to `localeNames`.
2. Add its values to `lib/ui-strings.ts` (hero, persona nav, board chrome, chat launcher).
3. Run the script. It translates both `*.mdx` and every `meta.json` to
   `meta.<locale>.json`, so the 73 nav files are handled for you.
4. Add the locale's machine-translation disclaimer copy.
5. Expect the build to grow by roughly one English-corpus's worth of pages.

Script guardrails worth knowing: concurrency 4, one retry per failure, failures listed at
the end rather than aborting the run, and a hard abort if projected spend passes $20.
Use `--limit 3` for a sample run before committing to a full corpus.

---

## Routes

| Route | Type | Purpose |
| --- | --- | --- |
| `/` (`app/[lang]/(home)/page.tsx`) | page | Answer-first hero. A search box that returns a cited AI answer, not a results list. Renders `<HeroAsk />`. |
| `/announcements` | page | Product announcements feed, sourced from `public/announcements.json`. |
| `/docs/[[...slug]]` | page | The documentation reader. All 588 articles. |
| `/api-reference` | page | Scalar-rendered REST API reference over `public/openapi/kissflow-api.json`. |
| `/es/...` | pages | Spanish locale of everything above. |
| `/api/rag/ask` | POST | Hero answer engine. Graph-grounded retrieval, returns a structured answer with citations. |
| `/api/chat` | POST | Docs chat assistant (streaming). Same retrieval knobs as the hero. |
| `/api/search` | GET | Fumadocs/Orama search, with API endpoints and SDK methods merged in from the RAG graph. |
| `/api/graph/query` | POST | Read-only query over the hand-maintained route list in `lib/rag/graph.ts`. Key and origin checks both fail open when unconfigured. |
| `/api/rag/dev-ask` | POST | Developer-facing answers grounded in that same route list. Same fail-open caveat. |
| `/api/scalar-proxy` | ALL | Same-origin proxy so the API reference "try it" button is not blocked by CORS. |
| `/llms.txt` | GET | Index of the corpus for LLM consumers. |
| `/llms-full.txt` | GET | Full corpus dump. |
| `/llms.mdx/docs/[[...slug]]` | GET | Raw markdown twin of any page. Backs the "View as Markdown" link and the copy-markdown button. |
| `/og/docs/[...slug]` | GET | Generated Open Graph images per page. |

`middleware.ts` runs the Fumadocs i18n middleware over everything except `api/`,
`_next`, `og`, `llms`, `favicon`, and files with extensions. The matcher deliberately
uses `api/` with a slash so `/api-reference` still gets the locale rewrite.

`/docs` has no index page, so `next.config.mjs` redirects `/docs` and `/:lang/docs`
to `/docs/get-started`. Those redirects exist only in dynamic mode; the static export
cannot serve them.

---

## Content model

### Layout

```
content/
  get-started/        26 files    onboarding
  use/                62          end-user tasks
  build/             704          app building (largest section by far)
  admin/             154          account administration
  develop/             4          only 2 English pages (index + an API/SDK pointer). Its
                                  api/, sdk/, webhooks/, custom-components/ and
                                  troubleshooting/ folders hold meta.json and no articles
  reference/         192          FAQs, glossary, troubleshooting
  whats-new/          20          release notes, important notices, discontinued services
  app-store/          10
  roadmap/             2          single page rendering <RoadmapBoard />
  pre-release-notes/   2          single page rendering <PreReleaseBoard />
```

Counts above are MDX files including their `.es.mdx` siblings, so the English article
count is half of each: 1,176 MDX files total = 588 English + 588 Spanish. Navigation
is driven by 73 `meta.json` files (plus 73 `meta.es.json`).

### Frontmatter contract

Every article is validated against `lib/frontmatter.ts` by `npm run validate` and again
in CI. Required: `title`, `description`, `contentType`, `persona`, `section`.

- `contentType`: `overview` | `guide` | `reference` | `tutorial` | `use-case` | `troubleshooting`
- `persona`: `end-user` | `citizen-developer` | `admin` | `pro-developer` | `shared`
- `section`: `get-started` | `use` | `build` | `admin` | `develop` | `reference` | `whats-new` | `roadmap` | `pre-release-notes` | `app-store`
- Optional: `planAvailability: { basic, enterprise }`, `lastVerifiedAgainst`, `tags[]`, `redirectTo`

`redirectTo` lets a page redirect to another site-relative path (with optional hash)
instead of rendering its own body. Useful for retiring an article without breaking links.

> Two schemas must stay in sync. `source.config.ts` re-declares the same custom keys
> because Fumadocs' `pageSchema` strips unknown frontmatter by default. If you add a
> frontmatter field to `lib/frontmatter.ts` and forget `source.config.ts`, the field
> validates fine and then silently disappears from `page.data` at build time.

### Persona routing (built, not wired)

`lib/personas.ts` maps a URL prefix to a persona and to a tailored prompt frame: end-user
pages ask an assistant to walk the task step by step, `build/` pages ask it to quote
formula syntax and field types exactly, `admin/` pages ask for security and governance
implications, `develop/` pages demand exact endpoints and an explicit "undocumented" when
something is missing.

None of it runs today. Its only consumer is `components/ai-page-actions.tsx`, which
nothing imports; the live popover sends one generic prompt for every page regardless of
persona. The `persona` frontmatter field is still real and still validated, it just does
not influence the assistant links. Wiring the frames back in is a small, high-value change.

### MDX components available to authors

Registered in `components/mdx.tsx` on top of the Fumadocs defaults:

- `<PlanBadge />` plan availability marker
- `<PersonaNav />` the persona card grid
- `<ScalarEmbed />` inline API reference embed
- `<RoadmapBoard />` roadmap board (card data lives in `components/roadmap-board.tsx`)
- `<PreReleaseBoard />` pre-release notes board (data in `public/prerelease/<year>.json`)

---

## Localization

Spanish is live as a full pilot: all 588 articles, plus UI chrome strings.

- Config: `lib/i18n.ts`. Locales `en` (default, hidden from URLs) and `es`.
- File convention: Fumadocs dot-suffix parser. `page.mdx` and `page.es.mdx` sit side by
  side; there is no parallel folder tree.
- UI strings for the custom components (hero, persona nav, board chrome, chat launcher)
  live in `lib/ui-strings.ts`. English values are byte-identical to the previous
  hardcoded strings. Card data (roadmap items, pre-release posts) is not translated.
- Translation pipeline: `node scripts/translate-docs.mjs --locale es [--files <glob>|--changed]`.
  Uses the project's own OpenAI key. `--changed` only translates files newer than their
  `.es.mdx` sibling. Failures retry once and are listed at the end without aborting.
- Glossary: `scripts/translation-glossary.json` holds the terms that stay in English.
  Currently: Kissflow, Kissflow AI, dataform, child table, Smart Link, Smart Import,
  RunJS, Run script, What's New, Kanban, and the protocol acronyms (API, SDK, REST,
  OAuth, SSO, SAML, SMTP, MCP, webhook). It is injected into every prompt, and it is
  meant to be edited as terms come up.
- Spanish pages carry a machine-translation disclaimer linking to the English original.
- `docs/es-review-top50.md` is the shortlist for native review.

`PRD.md` covers the full pilot scope and the phase-2 plan for French, German, and
Italian (rerun the same script per locale). Arabic/RTL is explicitly out of scope.

---

## Ask AI: the answer engine

Two surfaces, one retrieval pipeline.

- **Hero** (`components/hero-ask.tsx` to `/api/rag/ask`): one question, one cited answer.
- **Chat** (`components/ai-chat.tsx` + `components/ai-chat-launcher.tsx` to `/api/chat`):
  streaming multi-turn, built on the Vercel AI SDK `useChat` and the AI Elements
  component set in `components/ai-elements/`.

### Retrieval

The corpus is pre-baked into a committed knowledge graph, so there is no vector database
to run:

- `lib/rag/content-graph/graph.json`: 720 nodes (586 articles, 105 API operations,
  29 SDK methods) and 1,044 edges built from authored cross-links. 586 rather than 588
  because `/docs/roadmap` and `/docs/pre-release-notes` are component-only pages with no
  prose to retrieve.
- `lib/rag/content-graph/embeddings.json`: 28 MB of node embeddings
  (`text-embedding-3-small`).

Query flow: embed the question, cosine-match the top 6 seed nodes, then check the *top*
seed against a 0.45 floor. Below it, the route abstains without ever calling a model.
Above it, all 6 seeds go forward (there is no per-seed filtering), expanding up to 2 hops
to at most 12 nodes, and the answer is written strictly from those snippets. The answer prompt (`lib/rag/answer.ts`) forbids outside knowledge,
requires per-claim citations, and mandates a closing "Read more" link. Answers are
written in the page's language, deliberately, so browser auto-translate does not mangle
streamed text.

### Model routing

`lib/rag/model-router.ts` and `lib/rag/escalation.ts`:

| Tier | Model | When |
| --- | --- | --- |
| `luna` | `gpt-5.6-luna` | A single confident dominant seed. |
| `terra` | `gpt-5.6-terra` | Top seed below 0.6, or the top two seeds within 0.05 of each other and both above 0.5. Weak or ambiguous retrieval gets the stronger model so it hedges honestly. |

Thresholds were calibrated against a 13-query live benchmark (the results file the code
comments cite is not in the repo). Subgraph geometry (hop distance, article spread) is
deliberately not consulted: it pegged at the same values for trivial and hard queries alike.

`gpt-5.3-codex` is not an answer tier. On `/api/rag/dev-ask` it only turns the natural
language question into a structured graph query; the answer itself still comes from
luna or terra, picked by a separate breadth rule (more than 5 route hits escalates to
terra) because route hits carry no similarity scores for the geometry rule to read.

### Developer answer routes

`/api/graph/query` and `/api/rag/dev-ask` answer implementation-level questions about the
Kissflow application itself. Both read `lib/rag/graph.ts`, which is a hand-maintained
array of 23 route patterns (11 frontend, 12 backend, nearly all `method: 'ANY'`) plus a
`GRAPH_OVERVIEW` block of aggregate counts used as prompt metadata. It is not a generated
inventory and no snapshot file is loaded at runtime, so the surface is much smaller than
the counts suggest. Extending it means editing that file by hand.

`/api/graph/query` caps request bodies at 8 KB and results at 25. `/api/rag/dev-ask` has
no body-size cap.

> **Both routes fail open.** `hasValidApiKey()` returns `true` when
> `GRAPH_QUERY_API_KEY` is unset, and the origin check falls back to same-origin when
> `GRAPH_QUERY_ALLOWED_ORIGINS` is empty. On a public deployment with neither variable
> set, anything served from the site's own origin can query these routes. The route
> content is derived from internal Kissflow source, so set both variables anywhere the
> site is public.

### Agent-friendly surfaces

The site is built to be read by assistants as well as people:

- `/llms.txt` and `/llms-full.txt`
- A `.md` twin of every page via `/llms.mdx/docs/...`, surfaced in the UI as
  "View as Markdown" and by the copy-markdown button
- An "Open in" popover on every docs page (`components/open-page-popover.tsx`) with
  GitHub, View as Markdown, Claude, ChatGPT, Gemini, and Cursor entries. The assistant
  links carry one flat prompt (`Help me understand this documentation page: <url>`) and
  point at the HTML page, not the `.md` twin

---

## API reference

`/api-reference` renders `public/openapi/kissflow-api.json` with
`@scalar/api-reference-react`.

Regeneration procedure when the Kissflow API changes:

1. Export the updated Postman collection to JSON.
2. `npm run openapi:convert -- <path-to-collection.json>`
3. `npm run openapi:normalize-auth -- .tmp/openapi-draft.json .tmp/openapi-normalized.json`
4. Diff the normalized output against `public/openapi/kissflow-api.json`, then replace it.
5. `npm run openapi:lint`
6. Optionally re-run `scripts/ingest-openapi-graph.ts` so the answer engine picks up new
   operations.

Customizations worth knowing about, all in `app/[lang]/api-reference/page.tsx`:

- Scalar's attribution link is restyled into the Kissflow wordmark (light and dark).
- Required parameters show a red star instead of Scalar's grey "required" label.
- The version badge is hidden; the OpenAPI badge stays.
- Markdown tables are switched off Scalar's fixed layout, which was breaking words mid-token.
- Auth pre-selects `accessKeyId` **and** `accessKeySecret` together (a nested array, since
  Kissflow requires both headers; a flat array would be OR and 403).
- "Try it" requests route through `/api/scalar-proxy`. That works only on the dynamic
  deployment; on the static mirror try-it cannot run anyway.

---

## Community-sourced content

Two boards and one feed are populated by sync scripts against the Kissflow community
(a Forumbee instance), then committed as JSON:

| Script | Output | Contents |
| --- | --- | --- |
| `node scripts/sync-announcements.mjs` | `public/announcements.json` | 24 product announcements. |
| `node scripts/sync-prerelease-notes.mjs` | `public/prerelease/<year>.json` | 1,087 posts across 2023 (224), 2024 (221), 2025 (405), 2026 (237). |

The roadmap board is different: its cards are authored inline in
`components/roadmap-board.tsx`, not synced. Edit that file to change the roadmap.

---

## Migration corpus

The site was migrated off Forumbee. That machinery is kept in the repo because assets
still resolve against it:

- `migration/articles.json`: 644 parsed source articles (588 survived into `content/`;
  the rest were duplicates, dead pages, or consciously dropped during rework)
- `migration/mapping.csv`, `migration/assets-manifest.csv`: URL mapping and asset liveness
- `public/migration-assets/`: 2,196 downloaded files, about 1.6 GB, and the reason a full
  clone is large

Pipeline: `parse-forumbee-export.ts` to `harvest-assets.ts` to `migrate-html-to-mdx.ts`
(or `batch-migrate.ts`) to `place-migrated-content.ts` to `generate-redirects.ts`.
`place-migrated-content.ts` never overwrites an existing `content/*.mdx` and never
rewrites an existing `meta.json` title, so reworked articles survive a re-run.

---

## Scripts reference

| Script | Purpose |
| --- | --- |
| `validate-frontmatter.ts` | Frontmatter gate. Wired to `npm run validate` and CI. |
| `check-mdx-syntax.ts` | Fast standalone MDX parse check. Reports every broken file in one pass instead of whatever batch webpack bundles first. Misses plugin-time errors such as unknown Shiki languages. |
| `translate-docs.mjs` | Locale translation with glossary and incremental mode. |
| `build-content-graph.ts` | Regenerates the committed RAG graph and embeddings. Manual, not CI, not build-time. |
| `build-content-graph-direct.ts` | Structural graph straight from `content/` MDX, no LLM. Nodes are articles, edges are authored cross-links. |
| `enrich-graph-edges.ts` | Densifies the graph with cross-link edges. Extraction alone yields about 0.5 edges per node, which left the 2-hop expansion returning isolated seeds. |
| `build-fixture-embeddings.ts` | Embeddings for test fixtures. |
| `ingest-openapi-graph.ts` | Adds API operations to the graph as `api:{method}:{path}` nodes. Re-runnable. |
| `ingest-sdk-graph.ts` | Adds SDK methods, cited to the external developer portal. |
| `postman-to-openapi.ts`, `normalize-openapi-auth.ts`, `apply-auth-normalization.ts` | The OpenAPI regeneration chain. |
| `sync-announcements.mjs`, `sync-prerelease-notes.mjs` | Community sync. |
| `parse-forumbee-export.ts`, `harvest-assets.ts`, `migrate-html-to-mdx.ts`, `batch-migrate.ts`, `place-migrated-content.ts`, `generate-redirects.ts`, `cleanup-orphan-drafts.ts` | Migration chain. |
| `codegraph-helper.sh` | Codebase-graph helper behind the `graph:*` npm scripts. |

---

## Site chrome

Small pieces of behaviour that are easy to miss:

- **Time-aware theme** (`lib/theme.ts`, `components/theme-controller.tsx`): preference is
  `light`, `dark`, or `auto`. On `auto`, dark runs 18:00 to 06:00 local and the controller
  schedules the next flip at the boundary. Stored under `kissflow-docs-theme`.
- **Persistent docs tab menu** (`components/persistent-docs-tab-menu.tsx`): switches between
  Docs, API Reference, and the external SDK Guide at developers.kissflow.com.
- **Coachmark** (`lib/docs-coachmark.ts`): first-visit nudge toward that menu, dismissed
  per session via `sessionStorage`.
- **Hero visuals**: `components/computer-man.tsx` and `components/wing-field.tsx`, with
  assets in `public/hero/` and `public/hero-glass/`.
- **Search** (`components/search.tsx`): hits the dynamic `/api/search` route, which merges
  Orama results with API and SDK nodes pulled from the RAG graph, since those live outside
  `content/` and the Orama index never sees them.

---

## Deployment

Two targets, one codebase.

**GitHub Pages (static).** `.github/workflows/deploy.yml` runs on every push to `main`
and on manual dispatch: Node 21, `npm ci`, `npm run build` with
`NEXT_PUBLIC_BASE_PATH=/kissflow-docs` (which flips `output: 'export'`), then
`npm run validate`, then upload `out/` and deploy. Static means no API routes: Ask AI,
search-as-you-type against `/api/search`, the Scalar try-it proxy, and the `/docs`
redirects are all inert on this mirror.

**Vercel (dynamic).** Linked as project `kissflow-docs`. This is where the AI routes,
search, and the proxy actually run. `.vercelignore` keeps `.git`, `.codebase-memory`,
build output, and local env files out of the upload. It does *not* exclude
`public/migration-assets/`, so every deploy ships about 1.6 GB of migrated images.
The link lives in `.vercel/project.json` (gitignored); deploy triggers, production
branch, and env vars are configured in the Vercel dashboard, not in this repo.

> **CI runs no tests.** The deploy workflow is `npm ci`, `npm run build`,
> `npm run validate`. `npm test`, `npm run types:check`, and `check-mdx-syntax.ts` are
> never invoked. Frontmatter validity is the only automated gate on `main`.

> Validation also runs *after* the build, so a bad frontmatter key fails the job only
> once the (long) build has already finished.

---

## Repo layout

```
app/
  [lang]/            locale-scoped pages: home, announcements, docs, api-reference
  api/               chat, rag/ask, rag/dev-ask, graph/query, search, scalar-proxy
  llms.txt/  llms-full.txt/  llms.mdx/     agent-readable corpus routes
  og/                per-page Open Graph image generation
components/
  ai-elements/       AI Elements chat component set
  ui/                shared primitives (shadcn-style, see components.json)
  *.tsx              hero, chat, boards, persona nav, theme, search, MDX registry
content/             588 English MDX articles + 588 Spanish siblings + 73 meta.json pairs
lib/
  rag/               answer engine: retrieval, escalation, models, committed graph
  frontmatter.ts     the content contract
  i18n.ts  ui-strings.ts  personas.ts  theme.ts  source.ts  layout.shared.tsx
migration/           Forumbee export, mapping, asset manifest
public/
  migration-assets/  ~1.6 GB of migrated images
  openapi/  prerelease/  hero/  hero-glass/  branding/  announcements.json
  kissflow-logo.png, kissflow-logo-white.png   load-bearing: the API reference CSS
                                               swaps them in for Scalar's attribution
scripts/             validation, translation, graph builds, OpenAPI chain, sync, migration
test/                DOM/behaviour tests (.mjs, not in `npm test`)
docs/                design specs, implementation plans, session notes, review lists
```

Tracked files only. A working clone will also show untracked scratch (playwright crawls,
experiment components, agent tooling directories); none of it is part of the site.

---

## Known constraints and gotchas

- **Build time.** Measured at roughly 15 minutes for 1,774 pages before Spanish landed
  (that count is routes, not articles: docs pages plus the `.md` twins, OG images, and
  the other generated per-page routes). Two locales roughly double it. Worth revisiting
  before a third locale lands.
- **Repo size.** `public/migration-assets/` alone is about 1.6 GB. Expect a slow first clone.
- **`npm test` is narrow.** It runs only `lib/theme.test.ts` and `lib/rag/**/*.test.ts`.
  These existing tests are *not* in that glob and only run if invoked directly:
  `lib/docs-coachmark.test.ts`, `lib/site-metadata.test.ts`,
  `app/api/scalar-proxy/route.test.ts`, `scripts/normalize-openapi-auth.test.ts`, and
  everything in `test/*.test.mjs`.
- **Two frontmatter schemas.** `lib/frontmatter.ts` and `source.config.ts` must agree, or
  fields vanish silently at build time.
- **Static export drops features.** See [Deployment](#deployment).
- **Three unrelated redirect mechanisms.** Frontmatter `redirectTo` retires one article in
  favour of another and works everywhere. `next.config.mjs` redirects handle `/docs` to
  `/docs/get-started` and exist only in dynamic mode. `scripts/generate-redirects.ts`
  emits legacy `/documentation/<slug>` mappings from the migration and is a one-off
  generator, not a live route. They do not compose; pick by which problem you have.
- **Dead code, three pieces.** `lib/bot.ts` (a tool-calling assistant over help articles
  and the route list) is imported nowhere, and `OPENAI_MODEL` exists only to configure it.
  `components/ai-page-actions.tsx` is imported nowhere, and it is the only consumer of
  `lib/personas.ts`, so the persona prompt frames are dead with it. Wire them up or
  delete them; leaving them in makes the repo read as if features exist that do not.
- **Graph artifacts are committed, not generated.** `graph.json` and the 28 MB
  `embeddings.json` are checked in on purpose so the runtime needs no vector store. They go
  stale whenever articles change; re-run `build-content-graph.ts` (and the ingest scripts)
  after a significant content batch.
- **`progress.txt`** is an empty-bodied learnings log (a heading skeleton, no entries) left
  from an earlier workflow. Nothing reads it.

---

## Reference

- [Fumadocs](https://fumadocs.dev) and [Fumadocs MDX](https://fumadocs.dev/docs/mdx)
- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)
- [Vercel AI SDK](https://ai-sdk.dev)
- [Scalar API reference](https://github.com/scalar/scalar)
