import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { Article } from './parse-forumbee-export';

/**
 * Downloads every <img> referenced by migrating articles into
 * public/migration-assets/<article-slug>/ and records every <img>/<iframe>
 * in migration/assets-manifest.csv with a liveness status.
 *
 * Domains: media.forumbee.com S3 (dies when Forumbee sunsets), Kissflow
 * CloudFront (stable but localize anyway), googleusercontent (expiring
 * signed links — expect many dead; those must be recaptured by hand).
 */

const ASSET_ROOT = 'public/migration-assets';
const MANIFEST = 'migration/assets-manifest.csv';
const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

interface ManifestRow {
  targetPath: string;
  kind: 'img' | 'iframe';
  url: string;
  status: string; // downloaded | dead | timeout | embed | skipped
  httpCode: string;
  localPath: string; // site-absolute, e.g. /migration-assets/<slug>/1.png
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function loadTargets(): Map<string, string> {
  // oldUrl → targetPath for actions migrate/merge, from mapping.csv
  const map = new Map<string, string>();
  const lines = readFileSync('migration/mapping.csv', 'utf-8').split('\n');
  for (const line of lines.slice(1)) {
    // naive CSV: action/targetPath/oldUrl columns contain no commas or quotes
    const cols = line.match(/(".*?"|[^,]*)(,|$)/g)?.map((c) =>
      c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')
    );
    if (!cols || cols.length < 7) continue;
    const [, oldUrl, , action, targetPath] = cols;
    if ((action === 'migrate' || action === 'merge') && targetPath) {
      map.set(oldUrl, targetPath);
    }
  }
  return map;
}

async function fetchAsset(url: string): Promise<{
  status: string;
  httpCode: string;
  buf?: Buffer;
  ext?: string;
}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) return { status: 'dead', httpCode: String(res.status) };
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    const ext =
      EXT_BY_TYPE[type] ??
      (url.split('?')[0].match(/\.(png|jpe?g|gif|svg|webp)$/i)?.[1].toLowerCase() ??
        'png');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return { status: 'dead', httpCode: 'empty' };
    return { status: 'downloaded', httpCode: String(res.status), buf, ext };
  } catch (e: any) {
    return {
      status: e.name === 'AbortError' ? 'timeout' : 'dead',
      httpCode: e.name === 'AbortError' ? 'timeout' : (e.cause?.code ?? e.name),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const articles: Article[] = JSON.parse(
    readFileSync('migration/articles.json', 'utf-8')
  );
  const targets = loadTargets();

  // Collect unique asset URLs with the articles that use them
  interface Job {
    url: string;
    kind: 'img' | 'iframe';
    targetPaths: string[];
  }
  const jobs = new Map<string, Job>();
  for (const a of articles) {
    const target = targets.get(a.oldUrl);
    if (!target) continue;
    for (const [re, kind] of [
      [/<img[^>]+src="([^"]+)"/g, 'img'],
      [/<iframe[^>]+src="([^"]+)"/g, 'iframe'],
    ] as const) {
      for (const m of a.html.matchAll(re)) {
        let url = m[1];
        if (url.startsWith('//')) url = 'https:' + url;
        if (!/^https?:/.test(url)) continue;
        const job = jobs.get(url) ?? { url, kind, targetPaths: [] };
        job.targetPaths.push(target);
        jobs.set(url, job);
      }
    }
  }

  console.log(`${jobs.size} unique asset URLs across migrating articles`);
  const rows: ManifestRow[] = [];
  const queue = [...jobs.values()];
  let done = 0;
  const counterBySlug = new Map<string, number>();

  async function worker() {
    while (queue.length > 0) {
      const job = queue.shift()!;
      const owner = job.targetPaths[0];
      const slug = owner.split('/').pop()!;

      if (job.kind === 'iframe') {
        for (const tp of new Set(job.targetPaths)) {
          rows.push({ targetPath: tp, kind: 'iframe', url: job.url, status: 'embed', httpCode: '', localPath: '' });
        }
      } else {
        const r = await fetchAsset(job.url);
        let localPath = '';
        if (r.status === 'downloaded' && r.buf) {
          const n = (counterBySlug.get(slug) ?? 0) + 1;
          counterBySlug.set(slug, n);
          const rel = `${slug}/${n}.${r.ext}`;
          const abs = join(ASSET_ROOT, rel);
          mkdirSync(dirname(abs), { recursive: true });
          writeFileSync(abs, r.buf);
          localPath = `/migration-assets/${rel}`;
        }
        for (const tp of new Set(job.targetPaths)) {
          rows.push({ targetPath: tp, kind: 'img', url: job.url, status: r.status, httpCode: r.httpCode, localPath });
        }
      }
      done++;
      if (done % 100 === 0) console.log(`${done}/${jobs.size}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  rows.sort((a, b) => a.targetPath.localeCompare(b.targetPath));
  const csv = ['targetPath,kind,url,status,httpCode,localPath']
    .concat(rows.map((r) => [r.targetPath, r.kind, r.url, r.status, r.httpCode, r.localPath].map(csvEscape).join(',')))
    .join('\n');
  mkdirSync('migration', { recursive: true });
  writeFileSync(MANIFEST, csv);

  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  console.log(`Manifest: ${MANIFEST} (${rows.length} rows)`);
  console.log('Status:', JSON.stringify(byStatus, null, 2));
}

main();
