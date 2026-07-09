import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MiniSearch from 'minisearch';

export interface HelpSearchHit {
  url: string;
  title: string;
  heading: string;
  snippet: string;
}

interface HelpPage {
  url: string;
  title: string;
  text: string;
}

interface HelpChunk {
  id: string;
  url: string;
  title: string;
  heading: string;
  text: string;
}

export interface GraphSearchHit {
  source: 'frontend' | 'backend';
  route: string;
  method: string;
}

interface GraphRoute {
  source: 'frontend' | 'backend';
  route: string;
  method: string;
}

const MAX_HELP_HITS = 8;
const MAX_HELP_SNIPPET = 420;
const MAX_HELP_TEXT = 9000;
const MAX_GRAPH_HITS = 12;

const FRONTEND_GRAPH_ROUTES: GraphRoute[] = [
  { source: 'frontend', route: '/process/2/:accountId', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/:modelId/watchlist/:instanceId', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/:modelId/:instanceId/progress', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/:modelId/:instanceId/withdraw', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/:modelId/:instanceId/:resourceId/reject', method: 'ANY' },
  {
    source: 'frontend',
    route: '/process/2/:accountId/:modelId/:instanceId/:resourceId/reassign',
    method: 'ANY',
  },
  { source: 'frontend', route: '/process/:modelId/myitems', method: 'ANY' },
  { source: 'frontend', route: '/process/:modelId/manage/studio', method: 'ANY' },
  { source: 'frontend', route: '/process/:modelId/watchlist', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/publicform/:modelId', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/:processId/steps', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/:processId/fields', method: 'ANY' },
  { source: 'frontend', route: '/application/:applicationId', method: 'ANY' },
  { source: 'frontend', route: '/application/:appId', method: 'ANY' },
  { source: 'frontend', route: '/application/create', method: 'ANY' },
  { source: 'frontend', route: '/application/create/ai', method: 'ANY' },
  { source: 'frontend', route: '/application/:appId/manage', method: 'ANY' },
  { source: 'frontend', route: '/application/:appId/manage/roles', method: 'ANY' },
  { source: 'frontend', route: '/application/:appId/manage/share', method: 'ANY' },
  {
    source: 'frontend',
    route: '/application/2/:accountId/:currentAppId/sdk/decisiontable/:flowId/execute',
    method: 'ANY',
  },
  {
    source: 'frontend',
    route: '/application/2/:accountId/:appId/component/custom/process/:flowId/list',
    method: 'ANY',
  },
  {
    source: 'frontend',
    route: '/application/2/:accountId/:appId/component/custom/case/:caseId/list',
    method: 'ANY',
  },
];

const BACKEND_GRAPH_ROUTES: GraphRoute[] = [
  {
    source: 'backend',
    route: '/process/2/ProcessAccount001/Model001/Item004/AI04003/admin/reassign',
    method: 'ANY',
  },
  { source: 'backend', route: '/process/<path:filename>', method: 'ANY' },
  { source: 'backend', route: '/process/bulk-archive/<action_id>', method: 'ANY' },
  { source: 'backend', route: '/process/2/BaseAccount001/<process_id>/create/submit', method: 'POST' },
  { source: 'backend', route: '/process/<process_id>/steps', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/pwa', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/expression', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/instruction', method: 'ANY' },
  {
    source: 'backend',
    route: '/process/2/<account_id>/<process_id>/<instance_id>/<activity_id>/documentparser',
    method: 'ANY',
  },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/document', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/sequencenumber', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/export', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/subflow', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/dashboard', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/agent', method: 'ANY' },
  { source: 'backend', route: '/process/create', method: 'ANY' },
  { source: 'backend', route: '/process/generate', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>/count', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>', method: 'ANY' },
  { source: 'backend', route: '/application/<path:filename>', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>/flow/copy', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>/dependency', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>/page/create', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>/page/generate', method: 'ANY' },
  { source: 'backend', route: '/application/2/<account_id>/<application_id>/component/custom', method: 'ANY' },
  { source: 'backend', route: '/application/2/<account_id>/<application_id>/variable', method: 'ANY' },
  { source: 'backend', route: '/application/2/<account_id>/<application_id>/resource', method: 'ANY' },
];

export const GRAPH_OVERVIEW = {
  generatedOn: '2026-07-08',
  source: 'codebase-memory-mcp',
  frontend: {
    project: 'Users-abhiram-Documents-KF-code-kf-xg-frontend',
    nodes: 89453,
    edges: 315327,
    routes: 1392,
    functions: 41081,
    methods: 7407,
  },
  backend: {
    project: 'Users-abhiram-Documents-KF-code-kissflow-xg',
    nodes: 195691,
    edges: 768290,
    routes: 2304,
    functions: 7488,
    methods: 50558,
  },
} as const;

let helpCache:
  | {
      pages: Map<string, HelpPage>;
      search: MiniSearch<HelpChunk>;
    }
  | undefined;

let graphCache:
  | {
      frontend: MiniSearch<GraphRoute>;
      backend: MiniSearch<GraphRoute>;
    }
  | undefined;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.mdx?$/.test(entry.name) ? [full] : [];
  });
}

function deriveUrl(relPath: string): string {
  const segments = relPath.replace(/\.mdx?$/, '').split('/');
  if (segments[segments.length - 1] === 'index') segments.pop();
  return ['/docs', ...segments].join('/') || '/docs';
}

function stripMdx(body: string): string {
  return body
    .replace(/^(import|export)\s.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toChunks(page: HelpPage): HelpChunk[] {
  const sections = page.text.split(/^## +/m);
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

function getHelpStore() {
  if (helpCache) return helpCache;

  const contentDir = path.join(process.cwd(), 'content');
  const pages = new Map<string, HelpPage>();
  const chunks: HelpChunk[] = [];

  for (const file of walk(contentDir)) {
    const relPath = path.relative(contentDir, file).split(path.sep).join('/');
    const { data, content } = matter(fs.readFileSync(file, 'utf8'));
    const url = deriveUrl(relPath);
    const title = (data.title as string) ?? url;
    const text = stripMdx(content);
    const page: HelpPage = { url, title, text };
    pages.set(url, page);
    chunks.push(...toChunks(page));
  }

  const search = new MiniSearch<HelpChunk>({
    fields: ['title', 'heading', 'text'],
    storeFields: ['url', 'title', 'heading', 'text'],
  });
  search.addAll(chunks);

  helpCache = { pages, search };
  return helpCache;
}

function getGraphStore() {
  if (graphCache) return graphCache;

  const build = (routes: GraphRoute[]) => {
    const mini = new MiniSearch<GraphRoute>({
      fields: ['route', 'method'],
      storeFields: ['source', 'route', 'method'],
    });
    mini.addAll(routes);
    return mini;
  };

  graphCache = {
    frontend: build(FRONTEND_GRAPH_ROUTES),
    backend: build(BACKEND_GRAPH_ROUTES),
  };
  return graphCache;
}

export function searchHelpArticles(query: string): HelpSearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { search } = getHelpStore();
  return search
    .search(trimmed, { prefix: true, fuzzy: 0.2, boost: { title: 3, heading: 2 } })
    .slice(0, MAX_HELP_HITS)
    .map((hit) => ({
      url: hit.url as string,
      title: hit.title as string,
      heading: hit.heading as string,
      snippet: (hit.text as string).slice(0, MAX_HELP_SNIPPET),
    }));
}

export function readHelpArticle(url: string): HelpPage | null {
  const page = getHelpStore().pages.get(url);
  if (!page) return null;
  return { ...page, text: page.text.slice(0, MAX_HELP_TEXT) };
}

function searchGraphIndex(index: MiniSearch<GraphRoute>, query: string): GraphSearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return index
    .search(trimmed, { prefix: true, fuzzy: 0.2 })
    .slice(0, MAX_GRAPH_HITS)
    .map((hit) => ({
      source: hit.source as 'frontend' | 'backend',
      route: hit.route as string,
      method: (hit.method as string) || 'ANY',
    }));
}

export function searchFrontendGraph(query: string): GraphSearchHit[] {
  return searchGraphIndex(getGraphStore().frontend, query);
}

export function searchBackendGraph(query: string): GraphSearchHit[] {
  return searchGraphIndex(getGraphStore().backend, query);
}
