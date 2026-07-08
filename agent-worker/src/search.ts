import MiniSearch from 'minisearch';

export interface ChunksFile {
  pages: { url: string; title: string; text: string }[];
  chunks: { id: string; url: string; title: string; heading: string; text: string }[];
}

export interface SearchHit {
  url: string;
  title: string;
  heading: string;
  snippet: string;
}

export interface SearchApi {
  search(query: string): SearchHit[];
  getPage(url: string): { url: string; title: string; text: string } | null;
}

const MAX_HITS = 8;
const SNIPPET_LEN = 500;
const MAX_PAGE_LEN = 8000;

export function buildSearch(data: ChunksFile): SearchApi {
  const mini = new MiniSearch({
    fields: ['title', 'heading', 'text'],
    storeFields: ['url', 'title', 'heading', 'text'],
  });
  mini.addAll(data.chunks);
  const pagesByUrl = new Map(data.pages.map((p) => [p.url, p]));

  return {
    search(query) {
      return mini
        .search(query, { prefix: true, fuzzy: 0.2, boost: { title: 3, heading: 2 } })
        .slice(0, MAX_HITS)
        .map((hit) => ({
          url: hit.url as string,
          title: hit.title as string,
          heading: hit.heading as string,
          snippet: (hit.text as string).slice(0, SNIPPET_LEN),
        }));
    },
    getPage(url) {
      const page = pagesByUrl.get(url);
      if (!page) return null;
      return { url: page.url, title: page.title, text: page.text.slice(0, MAX_PAGE_LEN) };
    },
  };
}
