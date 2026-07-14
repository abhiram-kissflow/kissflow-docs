export type SourceMedia = {
  id: string;
  kind: 'image' | 'video';
  url: string;
  alt: string;
  title?: string;
};

export type ContentSection = {
  anchor: string;
  heading: string;
  text: string;
  media: SourceMedia[];
};

export type ContentSectionInput = {
  url: string;
  title: string;
  body: string;
};

type RawSection = { heading: string; anchor: string; body: string };

const H2 = /^##[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["']([^"']*)["'])?\s*\)/g;
const HTML_IMAGE = /<img\b[^>]*>/gi;
const IFRAME = /<iframe\b[^>]*>/gi;
const MARKDOWN_LINK = /\[([^\]]+)\]\(\s*(?:<([^>]+)>|([^\s)]+))[^)]*\)/g;
const BARE_URL = /https?:\/\/[^\s<>()\[\]]+/gi;

export function extractContentSections(input: ContentSectionInput): ContentSection[] {
  const sections = splitSections(input.title, input.body);
  return sections.map((section) => {
    const media = extractMedia(section.body, section.anchor);
    return {
      anchor: section.anchor,
      heading: section.heading,
      text: cleanText(section.body),
      media,
    };
  });
}

function splitSections(title: string, body: string): RawSection[] {
  const matches = [...body.matchAll(H2)];
  const sections: RawSection[] = [];
  const usedAnchors = new Map<string, number>();

  const intro = body.slice(0, matches[0]?.index ?? body.length);
  if (cleanText(intro)) sections.push({ heading: title, anchor: '', body: intro });

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const heading = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? body.length;
    sections.push({ heading, anchor: uniqueSlug(heading, usedAnchors), body: body.slice(start, end) });
  }

  return sections;
}

function uniqueSlug(value: string, used: Map<string, number>): string {
  const base = slug(value) || 'section';
  const count = (used.get(base) ?? 0) + 1;
  used.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractMedia(source: string, anchor: string): SourceMedia[] {
  const media: Omit<SourceMedia, 'id'>[] = [];
  const add = (item: Omit<SourceMedia, 'id'>) => media.push(item);

  for (const match of source.matchAll(MARKDOWN_IMAGE)) {
    add({ kind: 'image', url: match[2] ?? match[3], alt: match[1], ...(match[4] ? { title: match[4] } : {}) });
  }

  for (const tag of source.match(HTML_IMAGE) ?? []) {
    const url = htmlAttribute(tag, 'src');
    if (url) add({ kind: 'image', url, alt: htmlAttribute(tag, 'alt') ?? '', ...(htmlAttribute(tag, 'title') ? { title: htmlAttribute(tag, 'title')! } : {}) });
  }

  for (const tag of source.match(IFRAME) ?? []) {
    const url = htmlAttribute(tag, 'src');
    if (url && isSupportedVideo(url)) add({ kind: 'video', url, alt: htmlAttribute(tag, 'title') ?? '' });
  }

  for (const match of source.matchAll(MARKDOWN_LINK)) {
    const url = match[2] ?? match[3];
    if (isSupportedVideo(url)) add({ kind: 'video', url, alt: match[1] });
  }

  const withoutStructuredMedia = source
    .replace(MARKDOWN_IMAGE, '')
    .replace(HTML_IMAGE, '')
    .replace(IFRAME, '')
    .replace(MARKDOWN_LINK, '');
  for (const match of withoutStructuredMedia.matchAll(BARE_URL)) {
    const url = trimUrl(match[0]);
    if (isSupportedVideo(url)) add({ kind: 'video', url, alt: '' });
  }

  return media.map((item, index) => ({ id: `${anchor || 'introduction'}-media-${index + 1}`, ...item }));
}

function htmlAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function isSupportedVideo(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('vimeo.com');
  } catch {
    return false;
  }
}

function cleanText(source: string): string {
  return source
    .replace(/^\s*(?:import|export)\s+[^\n;]+;?\s*$/gm, '')
    .replace(MARKDOWN_IMAGE, '')
    .replace(HTML_IMAGE, '')
    .replace(IFRAME, '')
    .replace(MARKDOWN_LINK, (match, label: string, bracketUrl: string | undefined, plainUrl: string | undefined) => {
      const url = bracketUrl ?? plainUrl ?? '';
      return isSupportedVideo(url) ? '' : label;
    })
    .replace(BARE_URL, (match) => (isSupportedVideo(trimUrl(match)) ? '' : match))
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .split('\n')
    .map((line) => line.trim().replace(/[ \t]{2,}/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function trimUrl(url: string): string {
  return url.replace(/[.,;:!?]+$/, '');
}
