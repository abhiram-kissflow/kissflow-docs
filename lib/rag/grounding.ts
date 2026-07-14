import type { CitationAnswer } from './citation-schema';
import type { ContextNode } from './answer';

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
  const citations = result.citations.filter((citation) => {
    const node = nodesById.get(citation.nodeId);
    const key = `${citation.nodeId}\u0000${citation.snippet}`;
    if (!node || !citation.snippet || !node.snippet.includes(citation.snippet) || seenCitations.has(key)) {
      return false;
    }
    seenCitations.add(key);
    return true;
  });

  if (!citations.length) return abstention();

  const citedNodeIds = new Set(citations.map((citation) => citation.nodeId));
  const seenMedia = new Set<string>();
  const media = result.media.filter((selection) => {
    const node = nodesById.get(selection.nodeId);
    const key = `${selection.nodeId}\u0000${selection.mediaId}`;
    if (
      !node ||
      !citedNodeIds.has(selection.nodeId) ||
      !node.media?.some((sourceMedia) => sourceMedia.id === selection.mediaId) ||
      seenMedia.has(key)
    ) {
      return false;
    }
    seenMedia.add(key);
    return true;
  });

  return { answer: result.answer, citations, media, insufficientEvidence: false };
}

function abstention(): CitationAnswer {
  return { answer: '', citations: [], media: [], insufficientEvidence: true };
}
