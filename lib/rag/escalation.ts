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
  subgraph: SubgraphStats;
}

/** Tunable thresholds — defaults chosen to be revisited against real queries. */
export const ESCALATION = {
  /** Seeds are "ambiguous" only when both are relevant (above this floor)... */
  ambiguityScoreFloor: 0.5,
  /** ...and their scores are within this band of each other. */
  ambiguityScoreBand: 0.05,
  /** More than one hop from a seed to evidence signals multi-hop reasoning. */
  maxHopsBeforeEscalation: 1,
  /** Spanning more than this many source articles signals broad synthesis. */
  maxArticlesBeforeEscalation: 5,
} as const;

/**
 * Turns the qualitative escalation triggers (multi-hop reasoning, ambiguity,
 * broad synthesis) into concrete signals. Returns the model tier to use.
 * Pure — no I/O.
 */
export function decideModelTier({ seeds, subgraph }: EscalationInput): 'luna' | 'terra' {
  // Multi-hop: evidence was more than one hop from the seeds.
  if (subgraph.maxSeedHopDistance > ESCALATION.maxHopsBeforeEscalation) return 'terra';

  // Broad synthesis: the answer must reconcile many distinct articles.
  if (subgraph.distinctSourceArticles > ESCALATION.maxArticlesBeforeEscalation) return 'terra';

  // Ambiguity: the top two relevant seeds are nearly tied, so seed search
  // could not confidently pick a single best match.
  const sorted = [...seeds].sort((a, b) => b.score - a.score);
  if (sorted.length >= 2) {
    const [top, second] = sorted;
    const bothRelevant = second.score >= ESCALATION.ambiguityScoreFloor;
    const clustered = top.score - second.score < ESCALATION.ambiguityScoreBand;
    if (bothRelevant && clustered) return 'terra';
  }

  return 'luna';
}
