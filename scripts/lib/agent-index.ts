export interface DocChunk {
  id: string;
  url: string;
  title: string;
  heading: string;
  text: string;
}

export interface DocPage {
  url: string;
  title: string;
  text: string;
}

/** content-relative file path -> site-relative docs URL (no basePath). */
export function deriveUrl(relPath: string): string {
  const segments = relPath.replace(/\.mdx?$/, '').split('/');
  if (segments[segments.length - 1] === 'index') segments.pop();
  return ['/docs', ...segments].join('/') || '/docs';
}

/** Strip MDX-isms so chunks contain searchable prose. */
export function stripMdx(body: string): string {
  return body
    .replace(/^(import|export)\s.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Split a page body into per-## -section chunks. Chunk 0 is the intro. */
export function chunkPage(page: { url: string; title: string; body: string }): DocChunk[] {
  const sections = page.body.split(/^## +/m);
  return sections
    .map((section, i) => {
      if (i === 0) return { heading: '', text: section.trim() };
      const newline = section.indexOf('\n');
      const heading = (newline === -1 ? section : section.slice(0, newline)).trim();
      const text = newline === -1 ? '' : section.slice(newline + 1).trim();
      return { heading, text };
    })
    .filter((s) => s.text.length > 0 || s.heading.length > 0)
    .map((s, i) => ({
      id: `${page.url}#${i}`,
      url: page.url,
      title: page.title,
      heading: s.heading,
      text: s.text,
    }));
}
