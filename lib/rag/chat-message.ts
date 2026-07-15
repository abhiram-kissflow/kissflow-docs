import type { UIMessage } from 'ai';
import type { RagMedia } from './rag-media';

/** Persistent, validated RAG media carried beside the streamed chat text. */
export type RagChatMessage = UIMessage<never, { ragMedia: RagMedia[] }>;
