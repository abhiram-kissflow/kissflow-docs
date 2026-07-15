#!/usr/bin/env npx tsx
/**
 * Deterministic release-readiness check for RAG artifacts.
 *
 * This deliberately never calls an embedding or generation model. It verifies
 * that the published artifact can at least supply the exact section evidence
 * required by the curated corpus. Use --strict in CI/release verification.
 */
import fs from 'node:fs';
import path from 'node:path';
import { evaluateReleaseGate, type EvaluationCase } from '../lib/rag/evals';
import type { ContentGraph } from '../lib/rag/content-graph';

const ROOT = process.cwd();
const CASES_PATH = path.join(ROOT, 'lib/rag/evals/cases.json');
const GRAPH_PATH = path.join(ROOT, 'lib/rag/content-graph/graph.json');
const args = new Set(process.argv.slice(2));
const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex === -1 ? undefined : process.argv[outputIndex + 1];

if (outputIndex !== -1 && !outputPath) {
  throw new Error('rag:eval: --output requires a file path');
}

const cases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8')) as EvaluationCase[];
const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')) as ContentGraph;
const gate = evaluateReleaseGate(cases, graph);
const report = {
  generatedAt: new Date().toISOString(),
  mode: 'deterministic-artifact-coverage',
  status: gate.passed ? 'ready' : 'blocked',
  guidance: gate.passed
    ? 'Artifact coverage passed. Run the semantic retrieval and answer-quality suite before broad rollout.'
    : 'This is expected until section-level graph.json and embeddings.json are rebuilt. No quality claim is made from the current artifact.',
  ...gate,
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (outputPath) {
  const absoluteOutput = path.resolve(ROOT, outputPath);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, serialized);
  process.stdout.write(`RAG evaluation report written to ${absoluteOutput}\n`);
} else {
  process.stdout.write(serialized);
}

if (args.has('--strict') && !gate.passed) process.exitCode = 1;
