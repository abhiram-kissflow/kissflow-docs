import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  evaluateReleaseGate,
  validateEvaluationCorpus,
  type EvaluationCase,
} from './evals';
import type { ContentGraph } from './content-graph';

const supported: EvaluationCase = {
  id: 'child-table-setup',
  category: 'setup',
  query: 'How do I create a child table?',
  expected: { answerability: 'supported', section: '/docs/build/forms/creating-a-form#child-tables' },
};

const unsupported: EvaluationCase = {
  id: 'unsupported-kubernetes',
  category: 'unsupported',
  query: 'Can I self-host Kissflow on Kubernetes?',
  expected: { answerability: 'unsupported' },
};

const graphWithChildTable: ContentGraph = {
  nodes: [
    {
      id: supported.expected.section!,
      label: 'Creating a form',
      url: supported.expected.section!,
      articleUrl: '/docs/build/forms/creating-a-form',
      heading: 'Child tables',
      anchor: 'child-tables',
      snippet: 'Click Add table.',
      media: [],
      community: 0,
    },
  ],
  edges: [],
};

test('requires the full release-evaluation category coverage', () => {
  const issues = validateEvaluationCorpus([supported, unsupported]);
  assert.ok(issues.some((issue) => issue.includes('procedure')));
  assert.ok(issues.some((issue) => issue.includes('at least 50')));
});

test('reports category counts for release coverage review', () => {
  const result = evaluateReleaseGate([supported, unsupported], graphWithChildTable);
  assert.equal(result.corpus.categoryCounts.setup, 1);
  assert.equal(result.corpus.categoryCounts.unsupported, 1);
});

test('passes the artifact target check when a required section exists', () => {
  const result = evaluateReleaseGate([supported, unsupported], graphWithChildTable);
  assert.equal(result.artifact.sectionIndexReady, true);
  assert.deepEqual(result.artifact.missingExpectedSections, []);
  assert.equal(result.passed, false); // The tiny fixture intentionally fails corpus coverage.
});

test('reports missing expected sections instead of pretending article-level artifacts passed', () => {
  const result = evaluateReleaseGate([supported], { nodes: [] });
  assert.equal(result.artifact.sectionIndexReady, false);
  assert.deepEqual(result.artifact.missingExpectedSections, [supported.expected.section]);
  assert.equal(result.passed, false);
});

test('requires declared media evidence to be attached to its expected section', () => {
  const result = evaluateReleaseGate(
    [{ ...supported, expected: { ...supported.expected, media: true } }],
    graphWithChildTable,
  );
  assert.deepEqual(result.artifact.missingExpectedMedia, [supported.expected.section]);
});

test('ships a balanced, 50-plus-case release corpus', () => {
  const cases = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'lib/rag/evals/cases.json'), 'utf8'),
  ) as EvaluationCase[];
  assert.equal(validateEvaluationCorpus(cases).length, 0);
  assert.equal(
    cases.find((item) => item.id === 'setup-child-table')?.expected.section,
    '/docs/build/forms/creating-a-form#child-tables',
  );
});
