import assert from 'node:assert/strict';
import test from 'node:test';
import { askFromRag, type AskServiceDependencies } from './ask-service';
import type { ContentGraph, GraphNode } from './content-graph';
import type { CitationAnswer } from './citation-schema';

const childTables: GraphNode = {
  id: '/docs/build/forms/creating-a-form#child-tables',
  label: 'Creating a form',
  url: '/docs/build/forms/creating-a-form#child-tables',
  articleUrl: '/docs/build/forms/creating-a-form',
  heading: 'Child tables',
  anchor: 'child-tables',
  snippet: 'Click Add table to create a child table.',
  media: [],
  community: 0,
};

const graph: ContentGraph = { nodes: [childTables], edges: [] };

const grounded: CitationAnswer = {
  answer: 'Click **Add table** to create a child table.',
  claims: [{ markdown: 'Click **Add table** to create a child table.', citationIds: ['child'] }],
  citations: [{ id: 'child', nodeId: childTables.id, snippet: 'Click Add table to create a child table.' }],
  media: [],
  insufficientEvidence: false,
};

function makeDeps(): AskServiceDependencies & {
  embedValues: string[];
  generationInputs: Array<{ history: Array<{ role: 'user'; content: string }> }>;
} {
  const embedValues: string[] = [];
  const generationInputs: Array<{ history: Array<{ role: 'user'; content: string }> }> = [];
  return {
    embedValues,
    generationInputs,
    async embed(value) {
      embedValues.push(value);
      return [1, 0];
    },
    loadGraph() {
      return { graph, vectors: { [childTables.id]: [1, 0] } };
    },
    rankSections() {
      return [{ nodeId: childTables.id, score: 0.9 }];
    },
    async generate(input) {
      generationInputs.push({ history: input.history });
      return grounded;
    },
  };
}

test('uses the prior user question, not prior assistant prose, for a follow-up', async () => {
  const deps = makeDeps();
  const result = await askFromRag({
    query: 'How do I create one?',
    history: [
      { role: 'assistant', content: 'unsupported fact' },
      { role: 'user', content: 'What is a child table?' },
    ],
    deps,
  });

  assert.match(deps.embedValues[0], /What is a child table/);
  assert.doesNotMatch(result.modelMessages.map((message) => message.content).join('\n'), /unsupported fact/);
  assert.deepEqual(deps.generationInputs[0].history, [{ role: 'user', content: 'What is a child table?' }]);
});

test('returns sidebar sources only from validated citations', async () => {
  const deps = makeDeps();
  const result = await askFromRag({ query: 'Create a child table', history: [], deps });

  assert.deepEqual(result.sources, [{ title: 'Creating a form', url: '/docs/build/forms/creating-a-form' }]);
});

test('does not use graph traversal when direct section ranking supplies the evidence', async () => {
  const deps = makeDeps();
  const result = await askFromRag({ query: 'Create a child table', history: [], deps });

  assert.deepEqual(result.contextNodes.map((node) => node.id), [childTables.id]);
});
