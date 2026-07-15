import type { ContentGraph } from './content-graph';

export const EVALUATION_CATEGORIES = [
  'setup',
  'procedure',
  'sdk',
  'mobile',
  'analytics',
  'media',
  'followup',
  'unsupported',
] as const;

export type EvaluationCategory = (typeof EVALUATION_CATEGORIES)[number];
export type EvaluationCase = {
  id: string;
  category: EvaluationCategory;
  query: string;
  previousUserQuestion?: string;
  expected: {
    answerability: 'supported' | 'unsupported';
    /** Exact section URL required when the answer needs one precise procedure. */
    section?: string;
    /** A result should select at least one contextual asset when evidence contains it. */
    media?: boolean;
  };
};

export type EvaluationIssue = string;
export type ReleaseGateResult = {
  passed: boolean;
  corpus: { cases: number; issues: EvaluationIssue[]; categoryCounts: Record<EvaluationCategory, number> };
  artifact: {
    sectionIndexReady: boolean;
    graphNodes: number;
    missingExpectedSections: string[];
    missingExpectedMedia: string[];
  };
};

/**
 * Validates the corpus independently from any model, embedding, or network.
 * A release gate is intentionally strict: small hand-picked samples cannot
 * silently become a production benchmark.
 */
export function validateEvaluationCorpus(cases: readonly EvaluationCase[]): EvaluationIssue[] {
  const issues: EvaluationIssue[] = [];
  if (cases.length < 50) issues.push(`release corpus needs at least 50 cases; found ${cases.length}`);

  const ids = new Set<string>();
  const counts = categoryCounts(cases);
  for (const category of EVALUATION_CATEGORIES) {
    if (counts[category] === 0) issues.push(`release corpus has no ${category} case`);
  }

  for (const item of cases) {
    if (!item.id.trim()) issues.push('release corpus contains a case without an id');
    else if (ids.has(item.id)) issues.push(`release corpus has duplicate id: ${item.id}`);
    else ids.add(item.id);
    if (!item.query.trim()) issues.push(`release corpus case ${item.id || '<unknown>'} has no query`);
    if (item.category === 'followup' && !item.previousUserQuestion?.trim()) {
      issues.push(`followup case ${item.id} needs previousUserQuestion`);
    }
    if (item.expected.answerability === 'supported' && !item.expected.section) {
      issues.push(`supported case ${item.id} needs an expected section`);
    }
    if (item.expected.answerability === 'unsupported' && item.expected.section) {
      issues.push(`unsupported case ${item.id} must not name an expected section`);
    }
  }
  return issues;
}

/**
 * Verifies artifact coverage only. It does not claim semantic retrieval quality
 * because that requires query embeddings. This makes it safe to run before
 * OPENAI_API_KEY is configured, and makes old page-level artifacts fail openly.
 */
export function evaluateReleaseGate(
  cases: readonly EvaluationCase[],
  graph: Pick<ContentGraph, 'nodes'>,
): ReleaseGateResult {
  const issues = validateEvaluationCorpus(cases);
  const expectedSections = new Set(
    cases.flatMap((item) => (item.expected.answerability === 'supported' && item.expected.section ? [item.expected.section] : [])),
  );
  const indexedUrls = new Set(graph.nodes.map((node) => node.url));
  const missingExpectedSections = [...expectedSections].filter((section) => !indexedUrls.has(section));
  const mediaByUrl = new Map(graph.nodes.map((node) => [node.url, node.media ?? []]));
  const missingExpectedMedia = cases.flatMap((item) => {
    const section = item.expected.section;
    return item.expected.media && section && !(mediaByUrl.get(section)?.length)
      ? [section]
      : [];
  });
  const sectionIndexReady = graph.nodes.some((node) => Boolean(node.anchor) && node.url.includes('#'));
  return {
    passed:
      issues.length === 0 &&
      sectionIndexReady &&
      missingExpectedSections.length === 0 &&
      missingExpectedMedia.length === 0,
    corpus: { cases: cases.length, issues, categoryCounts: categoryCounts(cases) },
    artifact: { sectionIndexReady, graphNodes: graph.nodes.length, missingExpectedSections, missingExpectedMedia },
  };
}

export function categoryCounts(cases: readonly EvaluationCase[]): Record<EvaluationCategory, number> {
  const counts = Object.fromEntries(
    EVALUATION_CATEGORIES.map((category) => [category, 0]),
  ) as Record<EvaluationCategory, number>;
  for (const item of cases) counts[item.category] += 1;
  return counts;
}
