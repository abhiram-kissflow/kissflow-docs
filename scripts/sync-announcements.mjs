/**
 * Syncs product announcements from the Kissflow community
 * (community.kissflow.com/category/product-announcements, a Forumbee board)
 * into public/announcements.json for the AnnouncementsFeed component.
 *
 * The listing loads more topics via a JS "More" button (no server pagination),
 * so we drive a headless browser to reveal every topic, then fetch each topic
 * page (server-rendered) and extract title, date, hero image, and body HTML.
 *
 * Usage: node scripts/sync-announcements.mjs
 * Needs: npm i -D playwright cheerio (and npx playwright install chromium-headless-shell)
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

const LISTING = 'https://community.kissflow.com/category/product-announcements?sort=newest';
const ORIGIN = 'https://community.kissflow.com';
const OUT_FILE = path.join(process.cwd(), 'public', 'announcements.json');
// Pinned housekeeping posts in the category that are not product announcements.
const SKIP_SLUGS = new Set(['guidelines', 'community-guidelines', 'notification-setting']);
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
  for (let i = 0; i < 300; i++) {
    const more = p.locator('text=/^More$/').last();
    if (!(await more.isVisible().catch(() => false))) break;
    const before = urls.size;
    await more.click();
    await sleep(1500);
    await collect();
    if (urls.size === before) break;
  }
  await b.close();
  return [...urls];
}

async function scrapeOne(url) {
  const slug = url.split('/').pop() ?? '';
  if (SKIP_SLUGS.has(slug)) return null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (kissflow-docs-sync)' } });
    if (res.status === 503 || res.status === 429) {
      await sleep(2000 * attempt);
      continue;
    }
    if (res.status === 404) return null; // stale link in the listing
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const $ = cheerio.load(await res.text());
    const title = $('h1.topic__title').first().text().trim();
    if (!title) throw new Error('no title');
    const utc =
      $('.topic-meta [data-utc]').first().attr('data-utc') ??
      $('.topic__main [data-utc]').first().attr('data-utc') ??
      $('[data-utc]').first().attr('data-utc');
    const body = $('.topic__main .topic__text.formatted').first().length
      ? $('.topic__main .topic__text.formatted').first()
      : $('.topic__text.formatted').first();
    if (!body.length) throw new Error('no body');
    body.find('script, style, .site-brand__media').remove();
    body.find('a[href^="/"]').each((_, el) => {
      $(el).attr('href', `${ORIGIN}${$(el).attr('href')}`);
    });
    let hero = null;
    body.find('img').each((_, el) => {
      const src = $(el).attr('src') ?? '';
      if (!hero && src && !/emoji|icon|avatar/i.test(src)) hero = src;
    });
    const excerpt = body.text().replace(/\s+/g, ' ').trim().slice(0, 260);
    const id = url.match(/\/t\/([a-z0-9]+)\//)?.[1] ?? url;
    return {
      id,
      url,
      title: title.replace(/^[\s✨\u{1F389}\u{1F680}]+/u, '').trim(),
      epoch: utc ? Number(utc) : null,
      hero,
      excerpt,
      html: body.html().trim(),
    };
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
      const r = await scrapeOne(url);
      if (r && r.epoch) results.push(r);
    } catch (e) {
      failures.push({ url, error: String(e.message) });
    }
    await sleep(300);
  }
}
await Promise.all([worker(), worker()]);

results.sort((a, b) => (b.epoch ?? 0) - (a.epoch ?? 0));
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(results));
console.log(`done: ${results.length} announcements, ${failures.length} failures`);
if (failures.length) console.log(JSON.stringify(failures.slice(0, 10), null, 1));
