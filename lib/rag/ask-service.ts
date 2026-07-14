import { embed } from 'ai';
import { answerFromContext, type ContextNode, type HistoryTurn } from './answer';
import {
  groupSources,
  loadContentGraph,
  rankSections,
  type ArticleSource,
  type ContentGraph,
  type GraphNode,
  type SeedHit,
} from './content-graph';
import type { CitationAnswer } from './citation-schema';
import { decideModelTier } from './escalation';
import { validateGroundedAnswer } from './grounding';
import { EMBEDDING_MODEL } from './model-router';

const TOP_K = 8;
// This is an article-level calibration baseline. The evaluation suite must
// recalibrate it once the rebuilt section embeddings are checked in.
const SEED_SCORE_FLOOR = 0.45;

export interface AskGenerationInput {
  query: string;
  contextNodes: ContextNode[];
  tier: 'luna' | 'terra';
  /** Earlier user questions only. The current query is supplied separately. */
  history: Array<{ role: 'user'; content: string }>;
  locale?: string;
}

export interface AskServiceDependencies {
  embed(value: string): Promise<number[]>;
  loadGraph(): { graph: ContentGraph; vectors: Record<string, number[]> };
  rankSections(
    queryVector: number[],
    k: number,
    graph: ContentGraph,
    vectors: Record<string, number[]>,
  ): SeedHit[];
  generate(input: AskGenerationInput): Promise<CitationAnswer>;
}

export interface AskFromRagInput {
  query: string;
  history: HistoryTurn[];
  locale?: string;
  deps?: AskServiceDependencies;
}

export interface AskFromRagResult {
  answer: CitationAnswer;
  /** Exact section evidence supplied to, and selected by, the answer model. */
  contextNodes: ContextNode[];
  /** Public source cards derived only from validated, bound citations. */
  sources: ArticleSource[];
  /** Safe model conversation: prior user turns and the current question only. */
  modelMessages: Array<{ role: 'user'; content: string }>;
}

/**
 * Single trust boundary for both public assistants. Retrieval is direct
 * section ranking: graph traversal can enrich discovery elsewhere, but it
 * must not dilute a precise answer with unrelated neighboring sections.
 */
export async function askFromRag(input: AskFromRagInput): Promise<AskFromRagResult> {
  const deps = input.deps ?? productionDependencies;
  const query = input.query.trim();
  const priorUsers = input.history
    .filter((turn): turn is { role: 'user'; content: string } => turn.role === 'user' && typeof turn.content === 'string')
    .map((turn) => ({ role: 'user' as const, content: turn.content.trim() }))
    .filter((turn) => turn.content.length > 0)
    .slice(-6);
  const previousQuestion = priorUsers.at(-1)?.content ?? '';
  const modelMessages = [...priorUsers, { role: 'user' as const, content: query }];

  if (query.length < 2) return abstention(modelMessages);

  const retrievalText = previousQuestion ? `${previousQuestion}\n${query}` : query;
  const queryVector = await deps.embed(retrievalText);
  const { graph, vectors } = deps.loadGraph();
  const seeds = deps.rankSections(queryVector, TOP_K, graph, vectors);
  if (!seeds.length || seeds[0].score < SEED_SCORE_FLOOR) return abstention(modelMessages);

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const contextNodes = seeds
    .map((seed) => nodesById.get(seed.nodeId))
    .filter((node): node is GraphNode => node !== undefined)
    .map(toContextNode);
  if (!contextNodes.length) return abstention(modelMessages);

  const generated = await deps.generate({
    query,
    contextNodes,
    tier: decideModelTier({ seeds }),
    history: priorUsers,
    locale: input.locale,
  });
  const answer = validateGroundedAnswer(generated, contextNodes);
  const citedNodes = answer.citations
    .map((citation) => nodesById.get(citation.nodeId))
    .filter((node): node is GraphNode => node !== undefined);

  return { answer, contextNodes, sources: groupSources(citedNodes), modelMessages };
}

function abstention(modelMessages: AskFromRagResult['modelMessages']): AskFromRagResult {
  return {
    answer: { answer: '', claims: [], citations: [], media: [], insufficientEvidence: true },
    contextNodes: [],
    sources: [],
    modelMessages,
  };
}

function toContextNode(node: GraphNode): ContextNode {
  return {
    id: node.id,
    label: node.label,
    url: node.url,
    snippet: node.snippet,
    media: node.media,
  };
}

const productionDependencies: AskServiceDependencies = {
  async embed(value) {
    const result = await embed({ model: EMBEDDING_MODEL, value });
    return result.embedding;
  },
  loadGraph() {
    const { graph, index } = loadContentGraph();
    return { graph, vectors: index.vectors };
  },
  rankSections,
  async generate(input) {
    return await answerFromContext(input).object;
  },
};
