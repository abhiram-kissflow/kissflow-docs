import { openai } from '@ai-sdk/openai';

/** Verified OpenAI model ids (2026-07-10). Passed as strings via the SDK's
 *  (string & {}) fallback since GPT-5.6 postdates this @ai-sdk/openai build. */
export const RAG_MODELS = {
  luna: 'gpt-5.6-luna',
  terra: 'gpt-5.6-terra',
  devQuery: 'gpt-5.3-codex',
  embedding: 'text-embedding-3-small',
} as const;

export function resolveAnswerModel(tier: 'luna' | 'terra') {
  return openai(RAG_MODELS[tier]);
}

export const DEV_QUERY_MODEL = openai(RAG_MODELS.devQuery);
export const EMBEDDING_MODEL = openai.embedding(RAG_MODELS.embedding);
