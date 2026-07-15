import type { ContextNode } from './answer';
import type { CitationAnswer } from './citation-schema';

/**
 * The public result may contain only evidence the model can point to verbatim
 * in the supplied section context. It renders only validated claim blocks, so
 * an unrelated valid citation cannot authorize an extra answer assertion.
 */
export function validateGroundedAnswer(
  result: CitationAnswer,
  contextNodes: readonly ContextNode[],
): CitationAnswer {
  if (result.insufficientEvidence || !result.answer.trim()) return abstention();

  const nodesById = new Map(contextNodes.map((node) => [node.id, node]));
  const seenCitationIds = new Set<string>();
  const seenEvidence = new Set<string>();
  const citations = result.citations.flatMap((citation) => {
    const node = nodesById.get(citation.nodeId);
    const id = citation.id.trim();
    const snippet = citation.snippet.trim();
    const evidenceKey = `${citation.nodeId}\u0000${snippet}`;
    if (
      !node ||
      !id ||
      !snippet ||
      !node.snippet.includes(snippet) ||
      seenCitationIds.has(id) ||
      seenEvidence.has(evidenceKey)
    ) {
      return [];
    }
    seenCitationIds.add(id);
    seenEvidence.add(evidenceKey);
    return [{ id, nodeId: citation.nodeId, snippet }];
  });

  if (!citations.length) return abstention();

  const validCitationIds = new Set(citations.map((citation) => citation.id));
  const claims = result.claims.flatMap((claim) => {
    const markdown = claim.markdown.trim();
    const citationIds = [...new Set(claim.citationIds.map((id) => id.trim()).filter(Boolean))];
    const evidence = [...new Set(claim.evidence.map((excerpt) => excerpt.trim()).filter(Boolean))];
    const claimCitations = citations.filter((citation) => citationIds.includes(citation.id));
    if (
      !markdown ||
      !citationIds.length ||
      !evidence.length ||
      citationIds.some((id) => !validCitationIds.has(id)) ||
      evidence.some((excerpt) => !claimCitations.some((citation) => citation.snippet === excerpt)) ||
      !claimHasDeterministicSupport(markdown, evidence)
    ) return [];
    return [{ markdown, citationIds, evidence }];
  });
  const answer = claims.map((claim) => claim.markdown).join('\n\n');
  if (!claims.length || answer !== result.answer.trim()) return abstention();

  const boundCitationIds = new Set(claims.flatMap((claim) => claim.citationIds));
  const boundCitations = citations.filter((citation) => boundCitationIds.has(citation.id));
  const citedNodeIds = new Set(boundCitations.map((citation) => citation.nodeId));
  const seenMediaIdentities = new Set<string>();
  const media = result.media.filter((selection) => {
    const node = nodesById.get(selection.nodeId);
    const sourceMedia = node?.media?.find((media) => media.id === selection.mediaId);
    const identity = sourceMedia ? sourceMediaIdentity(sourceMedia) : null;
    if (!node || !citedNodeIds.has(selection.nodeId) || !sourceMedia || !identity || seenMediaIdentities.has(identity)) {
      return false;
    }
    seenMediaIdentities.add(identity);
    return true;
  });

  return { answer, claims, citations: boundCitations, media, insufficientEvidence: false };
}

/**
 * This is deliberately a conservative binding check, not semantic entailment:
 * it rejects claims that share no meaningful source language with the exact
 * excerpts they declare. Stronger semantic verification remains an evaluation
 * and model-quality concern, never a claim that this deterministic code proves.
 */
function claimHasDeterministicSupport(markdown: string, evidence: readonly string[]): boolean {
  if (/^read more\s*:/i.test(markdown.trim())) return true;
  const claim = significantTokens(markdown);
  return evidence.some((excerpt) => {
    const source = significantTokens(excerpt);
    if (!claim.size || !source.size) return false;
    if (claim.size === 1 && source.has([...claim][0])) return true;
    let overlap = 0;
    for (const token of claim) if (source.has(token)) overlap++;
    return overlap >= 2;
  });
}

function significantTokens(value: string): Set<string> {
  const stopwords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or', 'the', 'this', 'to', 'use', 'with', 'you']);
  return new Set(
    value
      .toLowerCase()
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
      .match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu)?.filter((token) => !stopwords.has(token)) ?? [],
  );
}

function abstention(): CitationAnswer {
  return { answer: '', claims: [], citations: [], media: [], insufficientEvidence: true };
}

function sourceMediaIdentity(media: NonNullable<ContextNode['media']>[number]): string | null {
  if (!media.url.trim()) return null;
  if (media.assetHash?.trim()) return `hash:${media.assetHash.trim()}`;
  if (media.dedupeKey?.trim()) return `key:${media.dedupeKey.trim()}`;
  return normalizeMediaUrl(media.url);
}

/** Removes fragments and cache-busting query keys without touching functional or signed parameters. */
function normalizeMediaUrl(value: string): string | null {
  const url = value.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url, 'https://kissflow.invalid');
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(?:_|cb|cache|cachebust|cachebuster|timestamp|ts|utm_.+|v|ver)$/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    const normalized = parsed.toString();
    return url.startsWith('/') ? normalized.replace('https://kissflow.invalid', '') : normalized;
  } catch {
    return null;
  }
}
