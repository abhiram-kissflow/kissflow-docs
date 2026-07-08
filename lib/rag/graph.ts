export interface GraphSearchHit {
  source: 'frontend' | 'backend';
  route: string;
  method: string;
}

export const GRAPH_OVERVIEW = {
  generatedOn: '2026-07-09',
  source: 'codebase-memory snapshot',
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

const FRONTEND_ROUTES: GraphSearchHit[] = [
  { source: 'frontend', route: '/process/2/:accountId/:modelId/watchlist/:instanceId', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/:modelId/:instanceId/progress', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/:modelId/:instanceId/withdraw', method: 'ANY' },
  { source: 'frontend', route: '/process/:modelId/myitems', method: 'ANY' },
  { source: 'frontend', route: '/process/:modelId/watchlist', method: 'ANY' },
  { source: 'frontend', route: '/process/2/:accountId/publicform/:modelId', method: 'ANY' },
  { source: 'frontend', route: '/application/:applicationId', method: 'ANY' },
  { source: 'frontend', route: '/application/create/ai', method: 'ANY' },
  { source: 'frontend', route: '/application/:appId/manage', method: 'ANY' },
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
];

const BACKEND_ROUTES: GraphSearchHit[] = [
  { source: 'backend', route: '/process/<path:filename>', method: 'ANY' },
  { source: 'backend', route: '/process/bulk-archive/<action_id>', method: 'ANY' },
  { source: 'backend', route: '/process/2/BaseAccount001/<process_id>/create/submit', method: 'POST' },
  { source: 'backend', route: '/process/<process_id>/steps', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/expression', method: 'ANY' },
  { source: 'backend', route: '/process/2/<account_id>/<process_id>/agent', method: 'ANY' },
  { source: 'backend', route: '/process/create', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>/flow/copy', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>/page/create', method: 'ANY' },
  { source: 'backend', route: '/application/<application_id>/page/generate', method: 'ANY' },
  { source: 'backend', route: '/application/2/<account_id>/<application_id>/component/custom', method: 'ANY' },
];

function scoreHit(query: string, hit: GraphSearchHit): number {
  const haystack = `${hit.route} ${hit.method}`.toLowerCase();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 2;
    if (hit.route.toLowerCase().includes(term)) score += 1;
  }
  return score;
}

function searchRoutes(routes: GraphSearchHit[], query: string, limit: number): GraphSearchHit[] {
  return routes
    .map((hit) => ({ hit, score: scoreHit(query, hit) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.hit);
}

export function searchFrontendGraph(query: string, limit = 12): GraphSearchHit[] {
  return searchRoutes(FRONTEND_ROUTES, query, limit);
}

export function searchBackendGraph(query: string, limit = 12): GraphSearchHit[] {
  return searchRoutes(BACKEND_ROUTES, query, limit);
}
