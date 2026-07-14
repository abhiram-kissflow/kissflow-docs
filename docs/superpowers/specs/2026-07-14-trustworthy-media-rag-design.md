# Trustworthy Media RAG Design

## Goal

Turn the documentation assistant from a page-level demo into a grounded answer
system that retrieves the relevant section of an article, produces detailed
answers supported by verified citations, and renders relevant source images and
videos inline.

## Scope

This design changes both end-user assistant surfaces: the hero RAG path
(`/api/rag/ask` and `HeroAsk`) and the floating chat widget (`/api/chat` and
its AI-chat components). Both surfaces use the same retrieval, grounding,
answer-depth, source, and media rules. It does not change the separate
developer graph-answering path.

## Problem

The current content graph has one node per article and stores only the leading
snippet of that article. A question about a later heading cannot retrieve its
evidence. The answer route then expands through neighbouring graph nodes and
sends all expanded nodes to the UI as “Relevant articles”, whether or not the
model cited them. Prior assistant text is also included in follow-up prompts,
which can preserve an earlier unsupported answer.

## Architecture

### Section chunks

The content-graph build produces one node for the pre-heading introduction and
one node for every `##` heading in each English article. Each node contains:

- Stable ID: `<article-url>#<section-slug>`.
- Article title and heading path.
- Canonical article URL plus section anchor.
- Full cleaned section text, without a leading-character truncation.
- Extracted media records belonging to that section.

The embedding input is the article title, heading path, and complete section
text. The build retains an article-level parent relationship only for source
grouping; answer retrieval uses direct semantic ranking of section nodes, not
broad BFS expansion.

### Media extraction and rendering

The build extracts local Markdown/MDX images, HTML images, and supported video
embeds or links from each section. A media record has `id`, `kind` (`image` or
`video`), `url`, `alt`, and an optional title.

The answer schema adds a `media` array. Every record must name a retrieved
section ID and a media ID that exists on that section. The model selects all
media that materially helps a reader follow the answer; it does not select
decorative or unrelated assets. Detailed answers may select multiple images and
videos when each one supports a distinct step or decision. The server validates
and normalizes this array before streaming the final response.

`HeroAsk` and the floating chat widget render every validated media record
inline below its associated answer. Images use descriptive alt text and
responsive sizing. Video URLs from an explicit allowlist render in a responsive
player; other videos render as clearly labelled external links. Duplicate assets
are rendered once.

### Grounding and conversation rules

The model receives only the ranked section chunks. It chooses answer depth from
the user's intent and the evidence: answer direct factual questions concisely;
give complete, step-by-step detail for setup, troubleshooting, comparison, or
other questions that need it. There is no arbitrary character or token limit
used to save cost. It must not pad a response, omit evidence-backed steps, or
assert a conclusion beyond the retrieved documentation. Each substantive claim
must have a cited section. If no retrieved section answers a question, the
answer abstains plainly rather than bluffing.

For follow-ups, retrieval may combine the immediately previous user question
with the current question. Model history includes prior user turns only; prior
assistant messages are never treated as source material. A previous answer
cannot override retrieved evidence.

### Sources

The API emits only validated cited sections as sources. The client renders
these sources in the sidebar, deduplicated by canonical article URL. It never
labels every retrieved section as relevant evidence.

## Quality gates

An executable evaluation corpus covers setup, procedural, SDK, mobile,
analytics, media-bearing, follow-up, and unsupported questions. Every case
states the expected section anchor and whether the answer should abstain.

The child-table setup case must retrieve the `Creating a form#child-tables`
section, answer with the **Add table** workflow, cite that section, and select
its relevant screenshot when present.

The release gate records:

- Section retrieval recall at the requested top-k.
- Citation validity: every cited section was retrieved and every quoted snippet
  is present in it.
- Media validity: every selected asset belongs to a cited section.
- Correct abstention for unsupported questions.

Benchmark results are committed with the corpus. Broad rollout requires that
all critical regression cases pass and that no answer is displayed with an
invalid citation or invalid media reference.

## Error handling and safety

Malformed or unavailable media is omitted rather than breaking an answer.
Unrecognized video providers are linked, never embedded. Invalid citations or
media selections are removed before the response reaches the client; if this
leaves an answer without supporting citations, the API returns an abstention.

## Out of scope

- Fine-tuning, a hosted vector database, and changing the answer model.
- Automatic media generation or third-party media search.
- Changes to developer graph RAG.
