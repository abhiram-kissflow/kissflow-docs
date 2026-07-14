import type { CitationAnswer } from './citation-schema';
import type { ContextNode } from './answer';

/** Short fragments such as a UI verb are too weak to audit as answer evidence. */
const MIN_CITATION_SNIPPET_LENGTH = 12;

/**
 * The public result may contain only evidence the model can point to verbatim
 * in the supplied section context. This boundary is deliberately pure so both
 * RAG entry points can apply the exact same trust rules.
 */
export function validateGroundedAnswer(
  result: CitationAnswer,
  contextNodes: readonly ContextNode[],
): CitationAnswer {
  if (result.insufficientEvidence || !result.answer.trim()) return abstention();

  const nodesById = new Map(contextNodes.map((node) => [node.id, node]));
  const seenCitations = new Set<string>();
  const citations = result.citations.flatMap((citation) => {
    const node = nodesById.get(citation.nodeId);
    const snippet = citation.snippet.trim();
    const key = `${citation.nodeId}\u0000${snippet}`;
    if (
      !node ||
      snippet.length < MIN_CITATION_SNIPPET_LENGTH ||
      !node.snippet.includes(snippet) ||
      seenCitations.has(key)
    ) {
      return [];
    }
    seenCitations.add(key);
    return [{ nodeId: citation.nodeId, snippet }];
  });

  if (!citations.length) return abstention();

  const citedNodeIds = new Set(citations.map((citation) => citation.nodeId));
  const seenMediaUrls = new Set<string>();
  const media = result.media.filter((selection) => {
    const node = nodesById.get(selection.nodeId);
    const sourceMedia = node?.media?.find((media) => media.id === selection.mediaId);
    if (
      !node ||
      !citedNodeIds.has(selection.nodeId) ||
      !sourceMedia ||
      seenMediaUrls.has(sourceMedia.url)
    ) {
      return false;
    }
    seenMediaUrls.add(sourceMedia.url);
    return true;
  });

  return { answer: result.answer, citations, media, insufficientEvidence: false };
}

function abstention(): CitationAnswer {
  return { answer: '', citations: [], media: [], insufficientEvidence: true };
}
