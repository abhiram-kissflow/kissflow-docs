import fs from 'node:fs';
import path from 'node:path';

const CONTENT_FILE = /\.mdx?$/i;
const LOCALIZED_CONTENT_FILE = /\.[a-z]{2,3}(?:-[a-z]{2,3})?\.mdx?$/i;

/**
 * Returns authored English documentation files. Localized siblings such as
 * `guide.es.mdx` are intentionally excluded so they never compete with the
 * canonical English URL during section indexing.
 */
export function discoverEnglishContentFiles(contentDir: string): string[] {
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && CONTENT_FILE.test(entry.name) && !LOCALIZED_CONTENT_FILE.test(entry.name)) files.push(full);
    }
  };
  visit(contentDir);
  return files.sort();
}
