# Community RAG Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build only the private Community sync, sanitization, review, mapping, and reviewed-export layers that supply the separately owned shared RAG foundation.

**Architecture:** A TypeScript CLI persists its private sync state in `~/.config/kf-community/community.sqlite`. Read-only crawling feeds raw records into a deterministic sanitizer and local approval queue. An approved export writer produces a schema-versioned JSONL/manifest contract. It does not call embedding APIs, create graph nodes, or modify RAG/API/UI files.

**Tech Stack:** Node.js 21+, TypeScript/tsx, jsdom, better-sqlite3, playwright-core, Node test runner.

---

## File structure

- Create `lib/community-rag/types.ts`: raw/private topic, sanitized topic, review, mapping, and export-contract types.
- Create `lib/community-rag/sanitize.ts`: deterministic PII/secret/legacy-URL removal and residual scanner.
- Create `lib/community-rag/store.ts`: private SQLite state, review decisions, and session cookies.
- Create `lib/community-rag/forumbee.ts`: category/topic parsing and relative-path fetch helpers.
- Create `lib/community-rag/migrate.ts`: migrated Fumadocs path/media mapping.
- Create `lib/community-rag/export.ts`: approved-record JSONL/manifest writer.
- Create `lib/community-rag/cli.ts` and `scripts/kf-community.ts`: command surface.
- Create colocated `*.test.ts` modules.
- Modify `package.json` only for CLI dependencies, commands, and test discovery.

## Task 1: Define the versioned export contract

**Files:**
- Create: `lib/community-rag/types.ts`
- Test: `lib/community-rag/types.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { communitySections, type CommunityExportRecord } from './types';

test('defines the supported sections', () => {
  assert.deepEqual(communitySections, ['get-help', 'documentation', 'product-updates']);
});

test('requires review, authority, and migration metadata', () => {
  const record: CommunityExportRecord = {
    schemaVersion: 1, id: 'forumbee:q6yg4v5', section: 'get-help',
    title: 'Sanitized title', body: 'Sanitized body', tags: [],
    createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z',
    authorityTier: 'moderated-community', reviewState: 'approved',
    migration: { status: 'unmapped' }, media: [], contentHash: 'a'.repeat(64),
    evidenceEligible: false,
  };
  assert.equal('sourceUrl' in record, false);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test lib/community-rag/types.test.ts`

Expected: fails because `./types` does not exist.

- [ ] **Step 3: Implement the minimum types**

Export `communitySections`, `CommunitySection`, `AuthorityTier`, `ReviewState`, `Migration`, `SafeMediaReference`, and `CommunityExportRecord`. Make `evidenceEligible` an explicit boolean and omit all raw-source and identity fields from the export type.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test lib/community-rag/types.test.ts`

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/community-rag/types.ts lib/community-rag/types.test.ts
git commit -m "feat: define reviewed Community export contract"
```

## Task 2: Implement deterministic sanitization

**Files:**
- Create: `lib/community-rag/sanitize.ts`
- Test: `lib/community-rag/sanitize.test.ts`

- [ ] **Step 1: Write failing redaction tests**

```ts
test('removes identities, secrets, and legacy URLs', () => {
  const result = sanitizeText('Ask Jane Doe at jane@acme.example. Token sk-abc123456789. See https://community.kissflow.com/t/q6yg4v5.');
  assert.equal(result.text.includes('Jane Doe'), false);
  assert.equal(result.text.includes('jane@acme.example'), false);
  assert.equal(result.text.includes('sk-abc123456789'), false);
  assert.equal(result.text.includes('community.kissflow.com'), false);
  assert.equal(result.safe, true);
});

test('withholds residual bearer credentials', () => {
  const result = sanitizeText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789');
  assert.equal(result.safe, false);
  assert.ok(result.reasons.includes('residual-secret'));
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test lib/community-rag/sanitize.test.ts`

Expected: fails because `sanitizeText` does not exist.

- [ ] **Step 3: Implement the sanitizer**

Replace configured names/organizations, mentions, profile URLs, Community URLs, emails, phone numbers, IP addresses, tenant domains, API keys, bearer tokens, cookies, and credential-bearing URLs. Re-scan output for residual secret/identity patterns and return `{ text, safe, reasons }`. Unsafe data is not exportable.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test lib/community-rag/sanitize.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/community-rag/sanitize.ts lib/community-rag/sanitize.test.ts
git commit -m "feat: sanitize Community content before review"
```

## Task 3: Add private store and review workflow

**Files:**
- Create: `lib/community-rag/store.ts`
- Test: `lib/community-rag/store.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing review-gate tests**

```ts
test('does not return a pending record for export', () => {
  const store = openStore(':memory:');
  store.upsertSanitized(topic('forumbee:a'));
  assert.deepEqual(store.exportableRecords(), []);
});

test('returns an approved mapped record as evidence eligible', () => {
  const store = openStore(':memory:');
  store.upsertSanitized(topic('forumbee:a'));
  store.approve('forumbee:a', 'official', { status: 'mapped', canonicalUrl: '/docs/a' });
  assert.equal(store.exportableRecords()[0].evidenceEligible, true);
});

test('returns an approved unmapped record as non-evidence', () => {
  const store = openStore(':memory:');
  store.upsertSanitized(topic('forumbee:a'));
  store.approve('forumbee:a', 'community', { status: 'unmapped' });
  assert.equal(store.exportableRecords()[0].evidenceEligible, false);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test lib/community-rag/store.test.ts`

Expected: fails because `openStore` does not exist.

- [ ] **Step 3: Implement private storage**

Add `better-sqlite3`, `@types/better-sqlite3`, and `playwright-core`. Create `topics`, `reviews`, `sync_state`, and `session_cookies` tables. Raw crawler text and session cookies remain private; only sanitized records can be approved. Store a relative Forumbee locator, never a public URL. Use SHA-256 content hashes; use `0700` directory and `0600` database permissions.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test lib/community-rag/store.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/community-rag/store.ts lib/community-rag/store.test.ts
git commit -m "feat: gate Community records through review"
```

## Task 4: Build parser and read-only CLI

**Files:**
- Create: `lib/community-rag/forumbee.ts`
- Create: `lib/community-rag/cli.ts`
- Create: `scripts/kf-community.ts`
- Test: `lib/community-rag/forumbee.test.ts`
- Test: `lib/community-rag/cli.test.ts`

- [ ] **Step 1: Write failing parser/command tests**

```ts
test('parses a topic ID and relative locator without retaining an absolute URL', () => {
  const topic = parseTopicHtml(fixtureHtml, 'get-help');
  assert.equal(topic.id, 'forumbee:q6yg4v5');
  assert.equal(topic.relativePath.startsWith('/t/q6yg4v5'), true);
  assert.equal(JSON.stringify(topic).includes('community.kissflow.com'), false);
});

test('sync uses only GET requests', async () => {
  const methods: string[] = [];
  await syncSection('documentation', { request: async (url, init) => { methods.push(init?.method ?? 'GET'); return fixtureResponse; } });
  assert.deepEqual(methods, ['GET']);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test lib/community-rag/forumbee.test.ts lib/community-rag/cli.test.ts`

Expected: fails because modules do not exist.

- [ ] **Step 3: Implement CLI commands**

Use jsdom for `parseCategoryHtml`, `parseTopicHtml`, and pagination. Implement `auth login` with a Playwright persistent browser at `~/.config/kf-community/browser`; pause for user SSO and save only Community cookies into the private store. Implement `sync`, `search`, `review list`, `review approve`, `review reject`, `export`, and `contract`. Follow `rel=next` and `?pg=`; never send a write request.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test lib/community-rag/forumbee.test.ts lib/community-rag/cli.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/community-rag/forumbee.ts lib/community-rag/forumbee.test.ts lib/community-rag/cli.ts lib/community-rag/cli.test.ts scripts/kf-community.ts
git commit -m "feat: add read-only Community sync CLI"
```

## Task 5: Add migration mapping and safe media policy

**Files:**
- Create: `lib/community-rag/migrate.ts`
- Test: `lib/community-rag/migrate.test.ts`

- [ ] **Step 1: Write failing mapping/media tests**

```ts
test('maps a legacy topic ID to a canonical Fumadocs path', () => {
  const map = buildMigrationMap([{ file: 'content/build/forms/example.mdx', body: 'See https://community.kissflow.com/t/q6yg4v5/example.' }]);
  assert.equal(map.get('q6yg4v5')?.canonicalUrl, '/docs/build/forms/example');
});

test('rejects remote Community media and permits an approved local asset', () => {
  assert.equal(toSafeMedia('https://community.kissflow.com/media/download/x', map), undefined);
  assert.deepEqual(toSafeMedia('/migration-assets/example.png', map), { kind: 'image', url: '/migration-assets/example.png', alt: '' });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test lib/community-rag/migrate.test.ts`

Expected: fails because mapping functions do not exist.

- [ ] **Step 3: Implement mapping**

Scan `content/**/*.mdx` and `content/**/*.md` for legacy topic IDs and derive canonical `/docs/...` paths. Emit media only if the path is an approved local Fumadocs asset under `/migration-assets/`; all Community-hosted media, attachments, and unknown remote URLs are dropped.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test lib/community-rag/migrate.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/community-rag/migrate.ts lib/community-rag/migrate.test.ts
git commit -m "feat: map Community records to safe Fumadocs assets"
```

## Task 6: Write reviewed export and boundary tests

**Files:**
- Create: `lib/community-rag/export.ts`
- Test: `lib/community-rag/export.test.ts`
- Modify: `lib/community-rag/cli.ts`

- [ ] **Step 1: Write failing export-boundary tests**

```ts
test('writes only approved records to records.jsonl', async () => {
  await writeExport(output, [approvedMapped, approvedUnmapped, pending]);
  const rows = await readJsonLines(path.join(output, 'records.jsonl'));
  assert.deepEqual(rows.map((row) => row.id), ['forumbee:mapped', 'forumbee:unmapped']);
  assert.equal(rows.find((row) => row.id === 'forumbee:unmapped').evidenceEligible, false);
});

test('never writes sensitive or legacy material to public export files', async () => {
  await writeExport(output, [approvedMappedWithFixtureValues]);
  const all = await readAllFiles(output);
  assert.equal(all.includes('community.kissflow.com'), false);
  assert.equal(all.includes('jane@acme.example'), false);
  assert.equal(all.includes('sk-abc123456789'), false);
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test lib/community-rag/export.test.ts`

Expected: fails because `writeExport` does not exist.

- [ ] **Step 3: Implement export**

Write a deterministic `manifest.json`, approved `records.jsonl`, and non-content `reviews.jsonl`. Validate at the writer boundary that every record is approved, that all strings omit legacy URLs and sensitive patterns, and that only local approved media references remain. Include schema version, review/authority tier, migration state, timestamps, hashes, and `evidenceEligible`. Update `export` command to call this writer.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test lib/community-rag/export.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Run complete scoped checks**

Run: `npm test && npm run types:check`

Expected: all existing and Community-ingestion tests pass; no RAG graph/API/UI files are modified.

- [ ] **Step 6: Commit**

```bash
git add lib/community-rag/export.ts lib/community-rag/export.test.ts lib/community-rag/cli.ts package.json
git commit -m "feat: export reviewed sanitized Community records"
```

## Operational handoff

- The CLI prints the contract schema with `npx tsx scripts/kf-community.ts contract`.
- The first protected sync starts with `npx tsx scripts/kf-community.ts auth login`; pause for user SSO.
- The shared RAG foundation must consume only `records.jsonl` entries whose `reviewState === 'approved'` and `evidenceEligible === true`.
- This work intentionally does not run embeddings, create graph nodes, or modify shared RAG/API/UI files.

