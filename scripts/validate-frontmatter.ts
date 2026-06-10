import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import matter from 'gray-matter';
import { frontmatterSchema } from '../lib/frontmatter';

const CONTENT_DIR = join(__dirname, '..', 'content');

function findMdxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findMdxFiles(full));
    } else if (entry.endsWith('.mdx') || entry.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

let errors = 0;
let warnings = 0;
const files = findMdxFiles(CONTENT_DIR);

for (const file of files) {
  const raw = readFileSync(file, 'utf-8');
  const { data } = matter(raw);
  const result = frontmatterSchema.safeParse(data);
  const rel = relative(CONTENT_DIR, file);

  if (!result.success) {
    errors++;
    console.error(`\n❌ ${rel}`);
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    }
  } else if (result.data.description.startsWith('DRAFT:') || result.data.description.startsWith('TODO:')) {
    warnings++;
    console.warn(`\n⚠️  ${rel}: description starts with DRAFT/TODO — needs real description before publish`);
  }
}

if (errors > 0) {
  console.error(`\n${errors} file(s) with invalid frontmatter.`);
  process.exit(1);
} else {
  console.log(`✅ All ${files.length} files have valid frontmatter.`);
  if (warnings > 0) {
    console.warn(`⚠️  ${warnings} file(s) with DRAFT/TODO descriptions.`);
  }
}
