# Postman → Scalar API Reference Migration

**Date:** 2026-07-09
**Status:** Approved design, not yet implemented
**Scope:** API docs only (Postman → Scalar → Fumadocs). SDK docs (developers.kissflow.com) migration is a separate, later spec.

## Context

Kissflow's API documentation currently lives as a Postman collection (`Kissflow API documentation.postman_collection.json`, also published at api.kissflow.com). This repo (`kissflow-docs`, Fumadocs-based) already anticipates migrating this to Scalar:

- `components/scalar-embed.tsx` exists as a Phase 1 stub — currently just an external link-out card, with a comment noting "Phase 2: Replaced with actual Scalar iframe embed."
- `content/develop/api/` exists as an empty, stubbed content section.
- No OpenAPI spec, `fumadocs-openapi`, or `@scalar/*` package currently exists in the repo.

The target UX is a nav dropdown (root toggle) that switches between the main docs and the API reference, matching the pattern used on Fumadocs' own site (Framework / UI / Core / MDX / CLI as flat peer entries).

## Source collection (verified 2026-07-09)

File: `/Users/abhiram/Downloads/Kissflow API documentation.postman_collection.json` (1.7MB, Postman Collection Schema v2.1)

- 106 requests across 10 folders, grouped into 6 top-level product modules:
  - Users and groups
  - Portals
  - Processes
  - Boards
  - Dataforms and dataform views
  - Dataset and dataset views
- Requests have per-endpoint descriptions and response examples (up to 4 per endpoint) — good raw material for schema inference.
- No structured OpenAPI spec exists today; Postman collection is the only source of truth.
- Auth: two custom headers per request, `X-Access-Key-Id` and `X-Access-Key-Secret`. Collection-level `auth` is set to `noauth` everywhere (headers are modeled manually, not via Postman's native auth block). Maps cleanly to a single shared OpenAPI `apiKey` security scheme (`in: header`), applied to every operation.
- Variables: `baseUrl`, `subdomain`, `Access key ID`.

## Architecture

Fumadocs' `RootToggle` (the dropdown pattern referenced) switches between multiple **page-tree sources** rendered inside one shared `DocsLayout`. Scalar's `@scalar/api-reference-react` doesn't fit that model — it renders its own complete UI (sidebar, search, layout), so embedding it inside Fumadocs' `DocsLayout` would produce two competing sidebars.

**Decision:** treat `/api-reference` as a standalone route, separate from the Fumadocs `/docs` page tree, with a small nav switcher providing the same visual dropdown UX without forcing a shared page-tree data model.

- `/docs` — existing Fumadocs content and `DocsLayout`, unchanged.
- `/api-reference` — new route. Client component mounting `@scalar/api-reference-react` against a static OpenAPI spec. Owns its own layout/sidebar (Scalar-native), not wrapped in Fumadocs' `DocsLayout`.
- Nav switcher — small addition to the shared nav (`lib/layout.shared.tsx` or equivalent), two entries ("Docs" / "API Reference"), styled to match the screenshot reference, does client-side route navigation between the two routes. Not a second `loader()` source in `lib/source.ts`.

## Components

- **`app/api-reference/page.tsx`** — new route at `/api-reference`. Client component wrapping `@scalar/api-reference-react`, pointed at the static spec file.
- **`public/openapi/kissflow-api.json`** — the authored OpenAPI 3.x spec, committed as a static file. Deliberately placed under `public/`, not `content/`, since `content/` is managed by the Fumadocs MDX loader/schema (`source.config.ts`) and a raw non-MDX JSON file there risks being swept into content processing. Output of the convert+enrich pipeline below.
- **Nav switcher component** — addition to shared layout, "Docs" / "API Reference" entries, matches existing screenshot-referenced dropdown styling.
- **`ScalarEmbed` (existing component, repurposed)** — currently a Phase 1 external-link stub. Becomes a deep-link component used inside narrative docs pages (`content/develop/api/*` articles) linking to a specific operation on `/api-reference#operation-id`, replacing the current external link to `api.kissflow.com`.
- **Spec-authoring pipeline** (tooling, not shipped app code):
  - `scripts/postman-to-openapi.mjs` — mechanical conversion of the Postman collection JSON into a draft OpenAPI 3.x spec.
  - Agent-assisted enrichment pass, run once per module (6 phases, following the collection's own top-level folders: Users and groups, Portals, Processes, Boards, Dataforms and dataform views, Dataset and dataset views). Each pass fills in schemas/examples using the Postman descriptions and response examples already present, and consolidates the two auth headers into the shared `apiKey` security scheme.
  - Lint/validate gate (Spectral or Redocly CLI) run per phase, before merging that module's enrichment into the final spec.

## Data flow

```
Postman collection JSON (local input, not committed to repo)
  → scripts/postman-to-openapi.mjs (mechanical conversion)
  → draft OpenAPI 3.x
  → agent enrichment, per module × 6 phases
      (fills schemas/examples from Postman descriptions + response examples,
       consolidates X-Access-Key-Id / X-Access-Key-Secret into one shared
       apiKey securityScheme)
  → Spectral/Redocly lint gate per phase
  → public/openapi/kissflow-api.json (committed, final)
  → @scalar/api-reference-react reads it client-side at /api-reference
  → full interactive reference (try-it, code samples, search) rendered
```

The nav switcher performs plain client-side route navigation between `/docs` and `/api-reference` — no shared page-tree data flow is needed since the two routes are independently rendered.

## Error handling / edge cases

- **Invalid spec fails the build, not the page.** The lint gate (Spectral/Redocly) runs as an npm script / CI check; a malformed `openapi.json` must fail before deploy rather than shipping a blank or crashed `/api-reference`.
- **Auth modeling.** The enrichment pass must declare `X-Access-Key-Id` / `X-Access-Key-Secret` once as a shared `securitySchemes` entry (type `apiKey`, `in: header`) referenced by every operation — not left duplicated per-endpoint the way the raw Postman conversion will initially produce it.
- **Spec drift.** The spec is a static file with no live sync from Postman or the backend. Document a manual regeneration procedure (README note or comment near the spec) for when the API changes. Conceptually similar to this repo's existing `lastVerifiedAgainst` frontmatter pattern for trust decay — worth reusing that framing, not necessarily the mechanism.
- **Phased rollout deep-links.** While only some of the 6 modules are enriched, `ScalarEmbed` deep-links referencing not-yet-migrated operations must fall back to linking the general `/api-reference` page rather than a dead anchor.

## Testing

- **Automated:** OpenAPI lint as an npm script (`@redocly/cli`), failing on an invalid spec — run against the committed spec and, at build time, gating a build failure on lint failure. Repo has no test runner (no vitest/jest/Playwright as a devDependency today — `docs/playwright-crawl/` is untracked scratch content, not a wired test suite), so this stays consistent with existing conventions (`tsx` scripts + `tsc`/lint gates) rather than introducing a new test framework for one route.
- **Manual:** `npm run dev`, visit `/api-reference`, confirm the page renders and a known operation is visible and interactive. Repeat per module as each phase's enrichment merges.

## Explicitly out of scope

- SDK docs (developers.kissflow.com) migration — confirmed as a separate, later spec. It is also Postman-hosted, so much of this pipeline (conversion script, enrichment pattern, lint gate) should be directly reusable when that spec is written, but the content, routing, and dropdown-entry work for it are not covered here.
- Any change to the existing `/docs` Fumadocs page tree or `lib/source.ts` loader — untouched by this work.
- Live/dynamic sync between the OpenAPI spec and the backend API or Postman collection — the spec is a static, manually-regenerated file for this phase.
