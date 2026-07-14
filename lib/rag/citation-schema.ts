import { z } from 'zod';

/**
 * The structured answer contract enforced on every RAG response, on both the
 * end-user and developer paths. The model must either cite the graph node IDs
 * it grounded the answer in, or set insufficientEvidence and explain what is
 * missing — it may never answer from outside the provided constrained context.
 */
export const citationAnswerSchema = z.object({
  answer: z.string().describe('The grounded answer. Empty string if insufficientEvidence is true.'),
  citations: z
    .array(
      z.object({
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
