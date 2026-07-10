import fs from 'node:fs';
import path from 'node:path';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

const GRAPH_DIR = path.join(process.cwd(), 'lib', 'rag', 'content-graph');
const MODEL = 'text-embedding-3-small';

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required');
  const graph = JSON.parse(fs.readFileSync(path.join(GRAPH_DIR, 'graph.json'), 'utf8')) as {
    nodes: { id: string; label: string; snippet: string }[];
  };
  const inputs = graph.nodes.map((n) => `${n.label}\n${n.snippet}`);
  const { embeddings } = await embedMany({ model: openai.embedding(MODEL), values: inputs });
  const vectors: Record<string, number[]> = {};
  graph.nodes.forEach((n, i) => {
    vectors[n.id] = embeddings[i];
  });
  const index = { model: MODEL, dim: embeddings[0].length, vectors };
  fs.writeFileSync(path.join(GRAPH_DIR, 'embeddings.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`Wrote ${graph.nodes.length} embeddings (dim ${index.dim}) to embeddings.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
