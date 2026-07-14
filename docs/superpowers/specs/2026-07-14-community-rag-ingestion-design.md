# Community RAG Ingestion Design

## Goal

Supply the shared Fumadocs RAG foundation with reviewed, sanitized Community records from Get Help, Product Documentation, and Product Updates. This work is an upstream content supplier only; it does not change retrieval, answer generation, citations, media rendering, conversational history, API routes, UI components, graph artifacts, or embeddings.

## Decision

Build a deterministic-first private sync and reviewed-export pipeline.

- The CLI crawls Forumbee pages in read-only mode. It requires a user-completed browser login only for protected pages.
- A local SQLite mirror retains raw crawler data, session material, and minimum relative locators outside the repository.
- Deterministic sanitization runs before a record can leave the private store.
- Each sanitized record enters a local review workflow. Only an approved record is exported.
- Exported records use stable Forumbee topic IDs, an explicit authority tier, review state, migration state, and evidence-eligibility flag.
- Legacy Community URLs are never emitted in the export contract or public artifacts.
- The shared RAG foundation is solely responsible for section extraction, embeddings, citation/media validation, evidence selection, and public assistant behavior.

## Non-goals

- Do not modify `lib/rag/content-graph.ts`, `lib/rag/answer.ts`, `app/api/rag/ask/route.ts`, `app/api/chat/route.ts`, hero/chat UI components, or public graph artifacts.
- Do not create graph nodes or call any embedding API.
- Do not fine-tune a model or use a generation model to sanitize all posts.
- Do not create public Fumadocs pages from Community content.
- Do not perform write actions against Community.

## Data flow

```text
Forumbee category/topic pages
  -> private read-only SQLite mirror
  -> deterministic sanitizer
  -> local review queue and approval decision
  -> stable reviewed export manifest + JSONL records
  -> shared RAG foundation (owned separately)
```

The private mirror may retain raw content and relative fetch locators until locally removed. The reviewed export must not contain raw content, session material, identities, credentials, legacy Community URLs, or unapproved data.

## Sanitization and review policy

Before export, remove or replace:

- Author/commenter names, handles, mentions, profile links, avatars, and organization/customer names.
- Email addresses, telephone numbers, IP addresses, tenant domains, account IDs, API keys, bearer tokens, cookies, and credential-bearing URLs.
- Legacy Community URLs and fragments.
- Attachments and images unless an approved migration map resolves the media to a safe, local Fumadocs asset.

A residual high-confidence secret, identity pattern, or unapproved media reference fails closed: the topic remains in the local review queue and is not exported.

A reviewer assigns:

- `reviewState`: `approved` or `rejected`.
- `authorityTier`: `official`, `moderated-community`, or `community`.
- `migration`: mapped canonical Fumadocs path or `unmapped`.

## Export contract

The CLI writes a stable local directory containing:

- `manifest.json`: schema version, generated timestamp, record count, and content hashes.
- `records.jsonl`: one approved sanitized record per line.
- `reviews.jsonl`: rejected/withheld records represented only by stable ID, reason codes, and timestamps; never raw text.

An approved record has this shape:

```json
{
  "schemaVersion": 1,
  "id": "forumbee:q6yg4v5",
  "section": "get-help",
  "title": "Sanitized title",
  "body": "Sanitized post and replies",
  "createdAt": "2026-07-14T00:00:00.000Z",
  "updatedAt": "2026-07-14T00:00:00.000Z",
  "tags": ["notification"],
  "authorityTier": "moderated-community",
  "reviewState": "approved",
  "migration": { "status": "mapped", "canonicalUrl": "/docs/use/..." },
  "media": [],
  "contentHash": "sha256...",
  "evidenceEligible": true
}
```

`evidenceEligible` is true only when a record is approved and mapped. Unmapped records may be exported for future migration work but must set it to false; the shared RAG layer must not use them as answer evidence.

## Acceptance criteria

1. The CLI lists, syncs, and searches all three sections without write operations.
2. Protected sync uses user-completed browser SSO and never accepts or stores a password.
3. Sanitization and review tests prove identity, credentials, and legacy URLs cannot enter the export.
4. Only approved records appear in `records.jsonl`.
5. Every unmapped record is marked `evidenceEligible: false`.
6. Media is emitted only when it is an approved, safe local Fumadocs reference.
7. The export contract is documented and versioned; it creates no graph nodes and calls no embedding API.

