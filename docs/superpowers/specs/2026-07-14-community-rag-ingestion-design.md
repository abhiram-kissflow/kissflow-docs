# Community RAG Ingestion Design

## Goal

Ingest the Kissflow Community's Get Help, Product Documentation, and Product Updates sections into the public Fumadocs RAG corpus while preserving useful discussion and replies, removing identifying or account-specific information, and never publishing legacy `community.kissflow.com` URLs.

## Decision

Build a deterministic-first ingestion pipeline.

- The CLI crawls Forumbee pages using an authenticated browser session only when a protected page requires it.
- It keeps a local SQLite mirror for sync state and on-the-go querying.
- A sanitization gate runs before any record is exported, embedded, committed, or made available to the public RAG endpoint.
- Public records use stable Forumbee topic IDs as source identity. They contain no legacy Community URL. A Fumadocs canonical URL is included only when a migration mapping exists.
- The existing RAG API receives the new content through incremental graph and embedding artifacts. Normal questions continue to use Luna; weak or ambiguous retrieval continues to escalate to Terra.

## Non-goals

- Do not archive Community URLs in the Fumadocs content tree, runtime graph, embeddings, citations, or Git history.
- Do not fine-tune a model on Community content.
- Do not use an LLM to process every post during ingestion.
- Do not create or publish new public Fumadocs pages from Community content in this first version.
- Do not perform write actions against the Community.

## Data flow

```text
Forumbee category and topic pages
  -> read-only CLI sync
  -> local SQLite mirror (sync metadata and query cache)
  -> deterministic sanitizer and rejection queue
  -> sanitized export keyed by topic ID
  -> incremental runtime graph and embeddings
  -> existing public /api/rag/ask endpoint
```

The SQLite mirror may retain the minimum remote locator required for a future sync, outside the repository. Exported records and public artifacts must not contain it.

## Sanitization policy

The sanitizer removes or replaces the following before persistence outside the local sync store:

- Author, commenter, and mentioned-person names; profile URLs; avatars; and user handles.
- Email addresses, telephone numbers, IP addresses, account/tenant domains, and customer organization identifiers.
- API keys, bearer tokens, secrets, cookies, identifiers with secret-like prefixes, and credential-bearing URLs.
- Attachments and embedded images. Their surrounding explanatory text may remain when it passes the other rules.
- Legacy Community URLs and URL fragments.

The pipeline must fail closed for a topic that still matches a high-confidence sensitive-data pattern after redaction. Such topics go to a local review queue and are not exported or embedded. A later version may add a local NER classifier for residual personal names; this is not required for the initial deterministic gate.

## Public record shape

Each exported topic is a sanitized document with front matter equivalent to:

```yaml
id: forumbee:<topic-id>
section: get-help | documentation | product-updates
tags: []
createdAt: ISO-8601
updatedAt: ISO-8601
canonicalUrl: /docs/... # omitted until mapped
contentHash: sha256
```

The body contains the sanitized title, original post, and ordered sanitized replies. It does not contain source URLs, authors, customer details, attachments, or raw Forumbee identifiers other than the stable topic ID.

## Graph and retrieval

The importer creates deterministic edges between topics sharing tags, category, and mapped Fumadocs documents. It reuses an embedding when `contentHash` is unchanged, embeds only changed public documents with `text-embedding-3-small`, and deletes removed vectors.

The existing RAG route remains responsible for seed retrieval, abstention, bounded subgraph expansion, streaming citations, and Luna-to-Terra escalation. An unmapped Community topic can contribute answer context but produces no external citation; mapped content cites only its Fumadocs canonical URL.

## Cost controls

- Sync, parsing, sanitization, SQLite queries, deduplication, and deterministic edge creation use no model tokens.
- Embedding is limited to changed sanitized documents, with a dry-run token estimate and a configurable maximum token budget before any API call.
- Semantic Graphify enrichment is deferred. It can be introduced later as an opt-in, budget-capped job over sanitized records only.
- No paid generation model is used in the ingestion path.

## Acceptance criteria

1. The CLI can list, sync, and search all three specified sections in read-only mode.
2. Protected Get Help sync requires a user-completed browser login but never accepts or stores a password.
3. Exported records, graph artifacts, embeddings, and runtime RAG citations contain no `community.kissflow.com` string.
4. Sensitive-data patterns are redacted or the topic is withheld and recorded for local review.
5. Re-running sync without changed content causes no embedding API request.
6. A changed sanitized topic produces exactly one updated graph node/vector and can be retrieved through the existing public RAG endpoint.
7. Tests cover URL removal, PII/secrets redaction, withheld-record behavior, stable IDs, content-hash reuse, and incremental embedding selection.
