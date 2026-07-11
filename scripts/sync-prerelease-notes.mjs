/**
 * Syncs pre-release notes from the Kissflow community changelog category
 * (Forumbee) into public/prerelease/<year>.json for the PreReleaseBoard
 * component.
 *
 * Usage: node scripts/sync-prerelease-notes.mjs
 * Needs: npm i -D playwright cheerio (and npx playwright install chromium-headless-shell)
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

const LISTING = 'https://community.kissflow.com/category/changelog?sort=newest';
const OUT_DIR = path.join(process.cwd(), 'public', 'prerelease');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function collectUrls() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
  await p.goto(LISTING, { waitUntil: 'networkidle', timeout: 60000 });
  const urls = new Set();
  const collect = async () => {
    (
      await p.evaluate(() =>
        Array.from(document.querySelectorAll('a[href*="/t/"]'))
          .map((a) => a.href.split('#')[0].split('?')[0])
          .filter((h) => /\/t\/[a-z0-9]+\//.test(h)),
      )
    ).forEach((l) => urls.add(l));
  };
  await collect();
  // Forumbee paginates with a "More" button at the bottom of the list.
  for (let i = 0; i < 300; i++) {
    const more = p.locator('text=/^More$/').last();
    if (!(await more.isVisible().catch(() => false))) break;
    const before = urls.size;
    await more.click();
    await sleep(2000);
    await collect();
    if (urls.size === before) break;
  }
  await b.close();
  return [...urls].sort();
}

async function scrapeOne(url) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (kissflow-docs-sync)' } });
    if (res.status === 503 || res.status === 429) {
      await sleep(2000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const $ = cheerio.load(await res.text());
    const title = $('h1.topic__title').first().text().trim();
    if (!title) throw new Error('no title');
    const utc =
      $('.topic-meta .localtime').first().attr('data-utc') ??
      $('.topic__main [data-utc]').first().attr('data-utc');
    const body = $('.topic__main .topic__text.formatted').first();
    if (!body.length) throw new Error('no body');
    body.find('a[href^="/"]').each((_, el) => {
      $(el).attr('href', `https://community.kissflow.com${$(el).attr('href')}`);
    });
    body.find('script, style').remove();
    const id = url.match(/\/t\/([a-z0-9]+)\//)?.[1] ?? url;
    return { id, url, title, epoch: utc ? Number(utc) : null, html: body.html().trim() };
  }
  throw new Error('rate-limited after retries');
}

const urls = await collectUrls();
console.log('topics found:', urls.length);

const results = [];
const failures = [];
let i = 0;
async function worker() {
  while (i < urls.length) {
    const url = urls[i++];
    try {
      results.push(await scrapeOne(url));
    } catch (e) {
      failures.push({ url, error: String(e.message) });
    }
    await sleep(400);
  }
}
await Promise.all([worker(), worker()]);

// Roadmap posts live in /docs/roadmap, not pre-release notes.
const EXCLUDE = new Set(['q6ypgaa']);
const kept = results.filter((r) => !EXCLUDE.has(r.id));
kept.sort((a, b) => (b.epoch ?? 0) - (a.epoch ?? 0));
const byYear = new Map();
for (const r of kept) {
  const y = r.epoch ? String(new Date(r.epoch).getUTCFullYear()) : 'undated';
  if (!byYear.has(y)) byYear.set(y, []);
  byYear.get(y).push(r);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [year, notes] of byYear) {
  fs.writeFileSync(path.join(OUT_DIR, `${year}.json`), JSON.stringify(notes));
  console.log(year, notes.length, 'notes');
}
console.log(`done: ${results.length} notes, ${failures.length} failures`);
if (failures.length) console.log(JSON.stringify(failures.slice(0, 10), null, 1));
