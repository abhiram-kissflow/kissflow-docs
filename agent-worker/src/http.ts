export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4000;

export function isAllowedOrigin(origin: string | null, allowedCsv: string): boolean {
  if (!origin) return false;
  return allowedCsv.split(',').map((s) => s.trim()).includes(origin);
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export type ValidationResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; error: string };

export function validateChatRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Invalid body' };
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return { ok: false, error: 'messages must be a non-empty array of at most 24 items' };
  }
  for (const m of messages) {
    if (
      typeof m !== 'object' ||
      m === null ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string' ||
      m.content.length === 0 ||
      m.content.length > MAX_MESSAGE_CHARS
    ) {
      return { ok: false, error: 'each message needs role user|assistant and content ≤4000 chars' };
    }
  }
  return { ok: true, messages: messages as ChatMessage[] };
}
