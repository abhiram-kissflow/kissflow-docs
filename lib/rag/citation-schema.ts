import { z } from 'zod';

/**
 * The structured answer contract enforced on every RAG response, on both the
 * end-user and developer paths. The model must either cite the graph node IDs
 * it grounded the answer in, or set insufficientEvidence and explain what is
 * missing — it may never answer from outside the provided constrained context.
 */
export const citationAnswerSchema = z.object({
  answer: z.string().describe('The rendered answer. It must equal the claim markdown blocks joined by two newlines, or be empty if insufficientEvidence is true.'),
  claims: z
    .array(
      z.object({
        markdown: z.string().describe('One complete rendered markdown block containing factual answer content.'),
        citationIds: z.array(z.string()).min(1).describe('IDs of citations that support this exact rendered block.'),
      }),
    )
    .describe('Every rendered factual answer block, in display order. Do not put unbound factual content in answer.'),
  citations: z
    .array(
      z.object({
        id: z.string().describe('A unique citation ID referenced by one or more claim citationIds.'),
        nodeId: z.string().describe('ID of a documentation section from the provided context that supports the answer.'),
        snippet: z.string().describe('A meaningful exact text excerpt from that section used as evidence.'),
      }),
    )
    .describe('Every documentation section whose content the answer relies on. Empty if insufficientEvidence is true.'),
  media: z
    .array(
      z.object({
        nodeId: z.string().describe('ID of a cited documentation section that owns the selected media.'),
        mediaId: z.string().describe('ID of source media from that cited section.'),
      }),
    )
    .describe('Only source media that directly supports the answer. Empty when no relevant media is available.'),
  insufficientEvidence: z
    .boolean()
    .describe('True when the provided context does not support a confident answer.'),
});

export type CitationAnswer = z.infer<typeof citationAnswerSchema>;
