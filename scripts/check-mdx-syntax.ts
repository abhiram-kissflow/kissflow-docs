import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import matter from 'gray-matter';

const processor = unified().use(remarkParse).use(remarkMdx);

/**
 * Fast standalone MDX parse check — bypasses webpack/Next so it reports
 * every broken file in one pass instead of whatever batch webpack happens
 * to bundle first. Catches parse-time errors (unclosed tags, dangling
 * `{`) but not plugin-time errors (e.g. Shiki language lookup).
 */

const CONTENT_DIR = 'content';

function findMdxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...findMdxFiles(full));
    else if (entry.endsWith('.mdx')) files.push(full);
  }
  return files;
}

async function main() {
  const files = findMdxFiles(CONTENT_DIR);
  const failures: { file: string; message: string }[] = [];

  for (const file of files) {
    const raw = readFileSync(file, 'utf-8');
    const { content } = matter(raw);
    try {
      const tree = processor.parse(content);
      await processor.run(tree);
    } catch (e: any) {
      failures.push({ file: relative('.', file), message: e.message });
    }
  }

  console.log(`Checked ${files.length} files.`);
  if (failures.length === 0) {
    console.log('All files parse cleanly.');
    return;
  }
  console.log(`${failures.length} file(s) with parse errors:\n`);
  for (const f of failures) {
    console.log(`${f.file}`);
    console.log(`  ${f.message.split('\n')[0]}`);
  }
  process.exitCode = 1;
}

main();
