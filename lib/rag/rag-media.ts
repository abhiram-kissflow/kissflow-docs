import type { ContextNode } from './answer';
import type { CitationAnswer } from './citation-schema';

/** Safe, display-ready media selected by the grounded-answer validator. */
export type RagMedia = {
  id: string;
  kind: 'image' | 'video';
  url: string;
  alt: string;
  title: string;
  sourceUrl: string;
};

/**
 * Expands the validator's node/media IDs into the exact source assets the UI
 * can render. Call this only after validateGroundedAnswer has removed any
 * unbound selections.
 */
export function mediaForDisplay(
  selections: CitationAnswer['media'],
  contextNodes: readonly ContextNode[],
): RagMedia[] {
  const nodes = new Map(contextNodes.map((node) => [node.id, node]));
  return selections.flatMap((selection) => {
    const node = nodes.get(selection.nodeId);
    const media = node?.media?.find((item) => item.id === selection.mediaId);
    if (!node || !media || !isSafeMediaUrl(media.url)) return [];
    return [{
      id: `${selection.nodeId}:${selection.mediaId}`,
      kind: media.kind,
      url: media.url,
      alt: media.alt,
      title: media.title ?? node.label,
      sourceUrl: node.url,
    }];
  });
}

/** Returns an embeddable URL only for the deliberately small video allowlist. */
export function toEmbeddableVideoUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    const id = url.pathname.startsWith('/embed/')
      ? url.pathname.split('/').filter(Boolean)[1]
      : url.searchParams.get('v');
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    const path = url.pathname.split('/').filter(Boolean);
    const id = host === 'player.vimeo.com' && path[0] === 'video' ? path[1] : path[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

export function isSafeMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Only local assets and explicitly approved HTTPS hosts may become inline
 * images. Other safe media URLs remain links so an imported article cannot
 * silently turn an arbitrary remote host into rendered page content.
 */
export function isAllowedInlineImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return false;
    return allowedMediaHosts().has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function allowedMediaHosts(): Set<string> {
  return new Set(
    (process.env.RAG_MEDIA_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}
