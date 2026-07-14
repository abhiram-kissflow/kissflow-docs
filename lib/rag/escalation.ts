export interface SeedScore {
  nodeId: string;
  /** Cosine similarity of the query against this seed node, in [-1, 1]. */
  score: number;
}

export interface SubgraphStats {
  /** Largest number of hops any seed needed to reach a citation-worthy node. */
  maxSeedHopDistance: number;
  /** Number of distinct source articles the constrained subgraph spans. */
  distinctSourceArticles: number;
}

export interface EscalationInput {
  seeds: SeedScore[];
}

/**
 * Thresholds calibrated against the 2026-07-14 live benchmark (13 queries,
 * bench/results_ours.json): legit queries' top seeds ranged 0.527–0.816.
 *
 * Subgraph stats (hop distance, distinct articles) are deliberately NOT
 * consulted: with MAX_NODES=12 over a sparse graph, the BFS fills its quota
 * on every query, so those stats measure expansion geometry, not question
 * difficulty — the benchmark showed them pegged at 11–12 articles / 2 hops
 * for trivial and hard queries alike, routing 13/13 queries to terra.
 */
export const ESCALATION = {
  /** Top seed below this = retrieval is unsure what the question is about. */
  weakEvidenceCeiling: 0.6,
  /** Seeds are "ambiguous" only when both are relevant (above this floor)... */
  ambiguityScoreFloor: 0.5,
  /** ...and their scores are within this band of each other. */
  ambiguityScoreBand: 0.05,
} as const;

/**
 * Routes a query to a model tier from seed-score geometry alone. Weak or
 * ambiguous retrieval goes to terra (the stronger model hedges honestly);
 * a confident dominant seed stays on luna. Pure — no I/O.
 */
export function decideModelTier({ seeds }: EscalationInput): 'luna' | 'terra' {
  const sorted = [...seeds].sort((a, b) => b.score - a.score);
  if (!sorted.length) return 'terra';

  // Weak evidence: even the best seed is a poor match for the question.
  if (sorted[0].score < ESCALATION.weakEvidenceCeiling) return 'terra';

  // Ambiguity: the top two relevant seeds are nearly tied, so seed search
  // could not confidently pick a single best match.
  if (sorted.length >= 2) {
    const [top, second] = sorted;
    const bothRelevant = second.score >= ESCALATION.ambiguityScoreFloor;
    const clustered = top.score - second.score < ESCALATION.ambiguityScoreBand;
    if (bothRelevant && clustered) return 'terra';
  }

  return 'luna';
}
