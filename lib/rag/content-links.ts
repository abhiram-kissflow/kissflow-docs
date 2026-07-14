export interface LinkableSectionNode {
  id: string;
  url: string;
  articleUrl?: string;
}

export interface ArticleBody {
  articleUrl: string;
  body: string;
}

export interface ContentLinkEdge {
  source: string;
  target: string;
  relation: 'links-to';
}

const DIRECT_DOC_LINK = /\]\((\/docs\/[^)#?\s]+)/g;
const LEGACY_TOPIC_LINK = /\]\(\/t\/[^/)]+\/([^)#?\s/]+)/g;
const EDGE_SEPARATOR = '\u0000';

/** Returns the canonical article URL for old page nodes and new section nodes. */
export function articleUrlOf(node: LinkableSectionNode): string {
  return node.articleUrl || node.url.split('#', 1)[0];
}

/**
 * Selects a stable representative for every article. Prefer its introduction
 * section when present; otherwise choose the first fragment alphabetically so
 * H2-only articles are linkable too.
 */
export function representativeSections(
  nodes: LinkableSectionNode[],
): Map<string, LinkableSectionNode> {
  const sorted = [...nodes].sort((a, b) => {
    const articleComparison = articleUrlOf(a).localeCompare(articleUrlOf(b));
    if (articleComparison !== 0) return articleComparison;
    const aIntro = a.url === articleUrlOf(a) ? 0 : 1;
    const bIntro = b.url === articleUrlOf(b) ? 0 : 1;
    if (aIntro !== bIntro) return aIntro - bIntro;
    return a.url.localeCompare(b.url) || a.id.localeCompare(b.id);
  });

  const representatives = new Map<string, LinkableSectionNode>();
  for (const node of sorted) {
    const articleUrl = articleUrlOf(node);
    if (!representatives.has(articleUrl)) representatives.set(articleUrl, node);
  }
  return representatives;
}

/**
 * Reapplies author-authored Markdown links after an article has been split
 * into section nodes. Existing links are respected bidirectionally, matching
 * the legacy enrichment behaviour.
 */
export function findContentLinkEdges(
  nodes: LinkableSectionNode[],
  articles: ArticleBody[],
  existingEdges: Array<{ source: string; target: string }> = [],
): ContentLinkEdge[] {
  const representatives = representativeSections(nodes);
  const bySlug = new Map<string, LinkableSectionNode | null>();
  for (const [articleUrl, node] of representatives) {
    const slug = articleUrl.split('/').pop()!;
    bySlug.set(slug, bySlug.has(slug) ? null : node);
  }

  const existing = new Set(existingEdges.map((edge) => `${edge.source}${EDGE_SEPARATOR}${edge.target}`));
  const hasEdge = (source: string, target: string) =>
    existing.has(`${source}${EDGE_SEPARATOR}${target}`) ||
    existing.has(`${target}${EDGE_SEPARATOR}${source}`);
  const added: ContentLinkEdge[] = [];

  for (const article of articles) {
    const source = representatives.get(article.articleUrl);
    if (!source) continue;

    const targets: Array<LinkableSectionNode | undefined> = [];
    for (const match of article.body.matchAll(DIRECT_DOC_LINK)) {
      targets.push(representatives.get(match[1].replace(/\/$/, '')));
    }
    for (const match of article.body.matchAll(LEGACY_TOPIC_LINK)) {
      targets.push(bySlug.get(match[1]) ?? undefined);
    }

    for (const target of targets) {
      if (!target || source.id === target.id || hasEdge(source.id, target.id)) continue;
      existing.add(`${source.id}${EDGE_SEPARATOR}${target.id}`);
      added.push({ source: source.id, target: target.id, relation: 'links-to' });
    }
  }
  return added;
}
