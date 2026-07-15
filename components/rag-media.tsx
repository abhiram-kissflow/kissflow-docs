import { ExternalLink, Play } from 'lucide-react';
import { isSafeMediaUrl, toEmbeddableVideoUrl, type RagMedia as RagMediaItem } from '@/lib/rag/rag-media';

export type { RagMedia as RagMediaItem } from '@/lib/rag/rag-media';

/**
 * Displays source media only after the RAG service has validated that it is
 * bound to a cited claim. This deliberately renders no authored HTML or MDX.
 */
export function RagMedia({ media, className = '' }: { media: RagMediaItem[]; className?: string }) {
  const safeMedia = media.filter((item) => isSafeMediaUrl(item.url));
  if (!safeMedia.length) return null;

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      {safeMedia.map((item) => (
        <MediaCard key={item.id} media={item} />
      ))}
    </div>
  );
}

function MediaCard({ media }: { media: RagMediaItem }) {
  const embedUrl = media.kind === 'video' ? toEmbeddableVideoUrl(media.url) : null;
  const caption = media.alt || media.title;

  return (
    <figure className="overflow-hidden rounded-xl border border-fd-border bg-fd-background">
      {media.kind === 'image' ? (
        <img
          src={media.url}
          alt={media.alt || media.title}
          loading="lazy"
          className="h-auto max-h-[32rem] w-full object-contain"
        />
      ) : embedUrl ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title={media.title || 'Documentation video'}
            className="h-full w-full border-0"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <a
          href={media.url}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-28 items-center justify-center gap-2 bg-fd-muted px-4 py-6 text-sm font-medium text-[#CF2C91] hover:bg-fd-accent"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          Watch video
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
      {caption ? (
        <figcaption className="border-t border-fd-border px-3 py-2 text-xs text-fd-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
