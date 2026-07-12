# PRD: Docs Localization — fumadocs i18n + own-key LLM pipeline (Spanish pilot)

## Introduction

kissflow.com markets in English, Spanish, French, German, and Italian, but the docs
exist only in English — a prospect landing on kissflow.com/es falls off a language
cliff when they open the docs. This feature adds locale infrastructure to
kissflow-docs (fumadocs i18n) and a repeatable, own-key LLM translation pipeline,
then ships a full Spanish pilot: all 588 MDX articles plus localized UI strings,
live behind a "machine-translated" disclaimer until native review.

Decisions locked with the user (2026-07-12):
- Pilot scope: full corpus (588 articles) in Spanish
- Surfaces: MDX content + UI strings (hero, nav, boards chrome)
- Publish: live with a per-page machine-translation disclaimer
- Model: gpt-5.6-luna, standard tier (~$4.60/language)
- Phase 2 (fr/de/it) reuses the same pipeline; not part of this PRD's stories

## Goals

- English docs remain at their current URLs; Spanish served under `/es/...`
- All 588 articles available in Spanish with MDX structure, frontmatter keys,
  component tags, and code blocks intact
- Kissflow glossary terms (dataform, board, flow, child table, Kissflow product
  names) stay untranslated
- Language switcher in the nav on every docs page
- Spanish pages show a dismissable machine-translation disclaimer
- Re-running the pipeline translates only new/changed files (incremental)
- Total pilot API cost ≤ $10

## User Stories

### US-001: i18n config and source loader
**Description:** As a developer, I need fumadocs to know about the `es` locale so
localized content can be loaded and routed.

**Acceptance Criteria:**
- [ ] `lib/i18n.ts` exports fumadocs i18n config: locales `en` (default) + `es`,
      default locale hidden from URLs (English URLs unchanged)
- [ ] `lib/source.ts` loader wired with the i18n config
- [ ] Localized files follow fumadocs suffix convention (`page.es.mdx`,
      `meta.es.json`) — no parallel folder tree
- [ ] `lib/frontmatter.ts` schema unchanged and still passes for suffixed files
- [ ] `npm run validate` passes
- [ ] Typecheck passes

### US-002: Locale routing in the app router
**Description:** As a reader, I want `/es/docs/...` URLs to serve Spanish pages so
I can browse the docs in my language.

**Acceptance Criteria:**
- [ ] App router restructured for fumadocs i18n (`/[lang]` param per fumadocs docs;
      English stays prefix-free)
- [ ] Root provider passes the active locale (fumadocs `I18nProvider` or
      equivalent per current fumadocs version)
- [ ] `/docs/get-started` (English) still returns 200 with identical content
- [ ] `/es/docs/get-started` returns 200 once a translated file exists
- [ ] `npm run build` succeeds
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-003: Language switcher in the nav
**Description:** As a reader, I want to switch between English and Español from the
docs nav so I can pick my language anywhere.

**Acceptance Criteria:**
- [ ] Language switcher visible in the docs layout nav (fumadocs built-in
      `i18n` layout option or a small custom control matching existing nav style)
- [ ] Switching preserves the current page path when the translation exists,
      falls back to the locale's docs root when it doesn't
- [ ] Works in light and dark mode
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-004: UI-string dictionary for custom components
**Description:** As a Spanish reader, I want the hero, persona nav, and board
chrome (labels, buttons, placeholders) in Spanish so the experience isn't
mixed-language.

**Acceptance Criteria:**
- [ ] `lib/ui-strings.ts` (or JSON per locale) holds en + es strings for:
      hero H1/subtitle/placeholder/BROWSE FOLDERS label, persona-nav card titles
      and descriptions, roadmap/pre-release board static labels (status pills,
      intro copy, filter aria-labels), AI chat launcher strings
- [ ] Components read strings via the active locale (prop or hook — smallest
      mechanism that works; no i18n library added)
- [ ] English rendering is byte-identical to current output
- [ ] Typecheck passes
- [ ] Verify changes work in browser (both locales)

### US-005: Translation script
**Description:** As a maintainer, I want `scripts/translate-docs.mjs` to translate
MDX files with our OpenAI key so localization is a repeatable script run, not a
vendor contract.

**Acceptance Criteria:**
- [ ] `node scripts/translate-docs.mjs --locale es [--files <glob>|--changed]`
      translates `content/**/*.mdx` to sibling `*.es.mdx` files
- [ ] Uses gpt-5.6-luna via the existing `OPENAI_API_KEY`; no new dependencies
      beyond what the repo already has
- [ ] Prompt preserves: frontmatter keys and enum values (only `title` and
      `description` values translated), MDX/JSX component tags, code blocks,
      image URLs, link targets
- [ ] Glossary file (`scripts/translation-glossary.json`) of terms kept in
      English; injected into every prompt
- [ ] `--changed` mode translates only files newer than their `.es.mdx` sibling
      (or missing siblings)
- [ ] Also translates `meta.json` titles/descriptions to `meta.es.json`
- [ ] Failures retry once, then are listed at the end without aborting the run
- [ ] Script run on 3 sample articles produces valid MDX that builds

### US-006: Spanish backfill — full corpus
**Description:** As a reader, I want every article available in Spanish so the
Spanish docs are complete, not a teaser.

**Acceptance Criteria:**
- [ ] Script run completes for all 588 articles + meta files (retries included);
      any unrecoverable failures listed and fixed or consciously deferred
- [ ] `npm run validate` passes (Spanish frontmatter valid)
- [ ] `npm run build` succeeds with both locales
- [ ] Spot-check 5 articles across sections (get-started, build, admin, develop,
      reference) render correctly at `/es/docs/...` in the browser
- [ ] Glossary terms verified untranslated in the spot-checked articles

### US-007: Machine-translation disclaimer on Spanish pages
**Description:** As an enterprise reader, I want to know a page was machine
translated so I can fall back to English for contractual precision.

**Acceptance Criteria:**
- [ ] Spanish docs pages render a slim banner (es copy) above the article:
      machine-translated notice + link to the English version of the same page
- [ ] Not shown on English pages
- [ ] Matches docs theme in light and dark mode
- [ ] Typecheck passes
- [ ] Verify changes work in browser

### US-008: Ship the pilot
**Description:** As the docs lead, I want the Spanish pilot live on main so
marketing-site visitors can be routed to Spanish docs.

**Acceptance Criteria:**
- [ ] Full production build passes (all locales, all pages)
- [ ] Search works on Spanish pages (per-locale index returns Spanish results)
- [ ] English spot-check: 5 known URLs unchanged (hero, roadmap, pre-release
      notes, one article, API reference tab behavior)
- [ ] Committed and pushed to main
- [ ] Post-ship note: cost actually spent, failure count, list of top-50 articles
      for the native reviewer

## Non-Goals

- No French/German/Italian in this PRD (phase 2 = rerun US-005/006 per locale)
- No Arabic/RTL work (separate engineering effort, needs deliberate layout pass)
- No RAG multilingual answers (separate small change, explicitly deferred)
- No translation of: pre-release notes JSON (1,089 ported posts), roadmap board
  card data, API reference (Scalar/OpenAPI), llms.txt routes, screenshots
- No human-review workflow/TMS tooling — review happens as a manual skim of the
  top-50 list from US-008
- No translation SaaS (GT, Crowdin, etc.)

## Technical Considerations

- Fumadocs i18n docs are the source of truth for US-001/002 wiring; check the
  installed fumadocs version's API before coding (parser: 'dot' suffix format)
- `content/` frontmatter schema is strict (`lib/frontmatter.ts`) — the script
  must emit exactly the same keys; only `title`/`description` values change
- Static build is ~15 min for 1,774 pages; two locales roughly doubles it —
  acceptable for the pilot, revisit before 5 locales
- Cost guardrail: log token usage per run; abort if projected cost exceeds $20
- Existing patterns to reuse: scripts/ folder conventions (sync-prerelease-notes,
  validate-frontmatter), scratchpad verification via headless playwright
