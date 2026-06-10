import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Convert Forumbee note/tip blocks to Fumadocs Callout components
// Types: info, warn, error, success, warning, idea
turndown.addRule('noteBlocks', {
  filter: (node) => {
    const el = node as HTMLElement;
    return (
      el.tagName === 'DIV' &&
      (el.classList?.contains('note') ||
        el.classList?.contains('tip') ||
        el.classList?.contains('warning') ||
        el.getAttribute('data-type') === 'note')
    );
  },
  replacement: (content, node) => {
    const el = node as HTMLElement;
    let type = 'info';
    if (el.classList?.contains('tip')) type = 'idea';
    if (el.classList?.contains('warning')) type = 'warn';
    return `\n<Callout type="${type}">\n${content.trim()}\n</Callout>\n`;
  },
});

// Strip &nbsp; spacer paragraphs
turndown.addRule('nbspParagraphs', {
  filter: (node) => {
    const el = node as HTMLElement;
    return (
      el.tagName === 'P' &&
      (el.innerHTML?.trim() === '&nbsp;' || el.textContent?.trim() === '')
    );
  },
  replacement: () => '\n',
});

// Strip inline style attributes
turndown.addRule('stripInlineStyles', {
  filter: (node) => {
    const el = node as HTMLElement;
    return !!(el.getAttribute?.('style'));
  },
  replacement: (content) => content,
});

function cleanGoogleRedirects(markdown: string): string {
  return markdown.replace(
    /https:\/\/www\.google\.com\/url\?q=([^&]+)&[^\s)]+/g,
    (_match, url) => decodeURIComponent(url)
  );
}

function fixNumberedLists(markdown: string): string {
  return markdown.replace(
    /^(\d+)\.\s+\*\*(.+?)\*\*/gm,
    '$1. **$2**'
  );
}

interface MigrationInput {
  html: string;
  targetPath: string;
  meta: {
    title: string;
    description: string;
    contentType: string;
    persona: string;
    section: string;
    tags?: string[];
    planAvailability?: { basic: boolean; enterprise: boolean };
  };
}

export function migrateArticle(input: MigrationInput): string {
  const dom = new JSDOM(input.html);
  const body = dom.window.document.body;

  body.querySelectorAll('script, style, nav, .sidebar, .breadcrumb').forEach(
    (el) => el.remove()
  );

  let markdown = turndown.turndown(body.innerHTML);
  markdown = cleanGoogleRedirects(markdown);
  markdown = fixNumberedLists(markdown);
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  const fm = [
    '---',
    `title: "${input.meta.title.replace(/"/g, '\\"')}"`,
    `description: "${input.meta.description.replace(/"/g, '\\"')}"`,
    `contentType: ${input.meta.contentType}`,
    `persona: ${input.meta.persona}`,
    `section: ${input.meta.section}`,
  ];

  if (input.meta.planAvailability) {
    fm.push('planAvailability:');
    fm.push(`  basic: ${input.meta.planAvailability.basic}`);
    fm.push(`  enterprise: ${input.meta.planAvailability.enterprise}`);
  }

  if (input.meta.tags && input.meta.tags.length > 0) {
    fm.push('tags:');
    for (const tag of input.meta.tags) {
      fm.push(`  - ${tag}`);
    }
  }

  fm.push('---');

  return `${fm.join('\n')}\n\n${markdown.trim()}\n`;
}

if (require.main === module) {
  const [htmlFile, targetPath, title] = process.argv.slice(2);

  if (!htmlFile || !targetPath || !title) {
    console.error('Usage: npx tsx scripts/migrate-html-to-mdx.ts <html-file> <target-path> <title>');
    console.error('Example: npx tsx scripts/migrate-html-to-mdx.ts article.html build/apps/creating-an-app "Creating an App"');
    process.exit(1);
  }

  const html = readFileSync(htmlFile, 'utf-8');
  const section = targetPath.split('/')[0];

  const mdx = migrateArticle({
    html,
    targetPath,
    meta: {
      title,
      description: `DRAFT: ${title}`,
      contentType: 'guide',
      persona: 'shared',
      section,
      tags: [],
    },
  });

  const outPath = join('content', `${targetPath}.mdx`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, mdx);
  console.log(`Written: ${outPath}`);
}
