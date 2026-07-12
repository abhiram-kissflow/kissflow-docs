/**
 * Translates content/**\/*.mdx (and meta.json) into a target locale using the
 * project's own OpenAI key. Output follows the fumadocs dot-suffix convention:
 * content/foo/bar.mdx -> content/foo/bar.es.mdx, meta.json -> meta.es.json.
 *
 * Usage:
 *   node scripts/translate-docs.mjs --locale es            # everything missing/stale
 *   node scripts/translate-docs.mjs --locale es --changed  # only new/changed files
 *   node scripts/translate-docs.mjs --locale es --files "content/get-started/**"
 *   node scripts/translate-docs.mjs --locale es --limit 3  # sample run
 *
 * Requires OPENAI_API_KEY (read from .env.local automatically).
 */
import fs from 'node:fs';
import path from 'node:path';

const MODEL = 'gpt-5.6-luna';
// Standard-tier pricing (USD per 1M tokens), for the cost guardrail.
const PRICE_IN = 1.0;
const PRICE_OUT = 6.0;
const COST_ABORT_USD = 20;
const CONCURRENCY = 4;

const LOCALE_NAMES = { es: 'Spanish', fr: 'French', de: 'German', it: 'Italian' };

// ---- args ----
const args = process.argv.slice(2);
function argValue(name) {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : undefined;
}
const locale = argValue('--locale');
const filesGlob = argValue('--files');
const limit = argValue('--limit') ? Number(argValue('--limit')) : Infinity;
const changedOnly = args.includes('--changed');

if (!locale || !LOCALE_NAMES[locale]) {
  console.error(`--locale required (one of: ${Object.keys(LOCALE_NAMES).join(', ')})`);
  process.exit(1);
}

// ---- env ----
if (!process.env.OPENAI_API_KEY && fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^OPENAI_API_KEY=(.*)$/);
    if (m) process.env.OPENAI_API_KEY = m[1].trim();
  }
}
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not set');
  process.exit(1);
}

const glossary = JSON.parse(
  fs.readFileSync(path.join('scripts', 'translation-glossary.json'), 'utf8'),
).keepInEnglish;

const language = LOCALE_NAMES[locale];

const SYSTEM = `You translate Kissflow product documentation (MDX) from English to ${language}.

Rules — breaking any of these makes the output unusable:
1. Return the COMPLETE file with the same structure. Translate only human-readable prose.
2. Frontmatter (between the first two --- fences): translate ONLY the values of
   "title" and "description". Every other key and value (contentType, persona,
   section, planAvailability, tags, lastVerifiedAgainst, redirectTo) must be
   byte-identical.
3. Never touch: code blocks, inline code, URLs, link targets, image paths,
   JSX/MDX component tags and their props (e.g. <PersonaNav />, <PlanBadge ... />),
   HTML attributes, heading anchors.
4. Translate link TEXT and image alt text; never the target.
5. Keep these terms in English exactly as written: ${glossary.join(', ')}.
6. Keep Markdown structure identical: same headings, lists, tables, emphasis.
7. Use natural, professional ${language} ("tú" form for instructions in Spanish).
Return ONLY the translated file content, no commentary, no code fences around it.`;

let totalIn = 0;
let totalOut = 0;

function cost() {
  return (totalIn / 1e6) * PRICE_IN + (totalOut / 1e6) * PRICE_OUT;
}

async function callModel(content) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content },
        ],
      }),
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 3000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    totalIn += data.usage?.prompt_tokens ?? 0;
    totalOut += data.usage?.completion_tokens ?? 0;
    if (cost() > COST_ABORT_USD) {
      throw new Error(`cost guardrail hit: $${cost().toFixed(2)} > $${COST_ABORT_USD}`);
    }
    let text = data.choices[0].message.content.trim();
    // Strip an accidental wrapping code fence.
    if (text.startsWith('```')) text = text.replace(/^```\w*\n/, '').replace(/\n```$/, '');
    return text;
  }
  throw new Error('rate-limited after retries');
}

// ---- frontmatter validation ----
function frontmatterKeys(mdx) {
  const m = mdx.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  return m[1]
    .split('\n')
    .filter((l) => /^[a-zA-Z]/.test(l))
    .map((l) => l.split(':')[0].trim())
    .sort();
}

function invariantValues(mdx) {
  const m = mdx.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const keep = {};
  for (const line of m[1].split('\n')) {
    const k = line.split(':')[0]?.trim();
    if (['contentType', 'persona', 'section', 'redirectTo'].includes(k)) {
      keep[k] = line.slice(line.indexOf(':') + 1).trim();
    }
  }
  return keep;
}

async function translateMdx(srcPath, outPath) {
  const src = fs.readFileSync(srcPath, 'utf8');
  const out = await callModel(src);

  const srcKeys = frontmatterKeys(src);
  const outKeys = frontmatterKeys(out);
  if (JSON.stringify(srcKeys) !== JSON.stringify(outKeys)) {
    throw new Error('frontmatter keys changed');
  }
  if (JSON.stringify(invariantValues(src)) !== JSON.stringify(invariantValues(out))) {
    throw new Error('invariant frontmatter values changed');
  }
  fs.writeFileSync(outPath, out.endsWith('\n') ? out : out + '\n');
}

async function translateMeta(srcPath, outPath) {
  const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const translatable = {};
  if (src.title) translatable.title = src.title;
  if (src.description) translatable.description = src.description;
  if (!Object.keys(translatable).length) {
    fs.writeFileSync(outPath, JSON.stringify(src, null, 2) + '\n');
    return;
  }
  const out = await callModel(
    `Translate the JSON string values to ${language}. Return ONLY valid JSON with the same keys.\n${JSON.stringify(translatable)}`,
  );
  const translated = JSON.parse(out);
  fs.writeFileSync(outPath, JSON.stringify({ ...src, ...translated }, null, 2) + '\n');
}

// ---- collect work ----
function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(p, out);
    else out.push(p);
  }
  return out;
}

const localeSuffixRe = new RegExp(`\\.(${Object.keys(LOCALE_NAMES).join('|')})\\.(mdx|json)$`);
const all = collect('content').filter((p) => !localeSuffixRe.test(p));
const sources = all.filter((p) => p.endsWith('.mdx') || p.endsWith('meta.json'));

function outPathFor(p) {
  return p.endsWith('.mdx')
    ? p.replace(/\.mdx$/, `.${locale}.mdx`)
    : p.replace(/meta\.json$/, `meta.${locale}.json`);
}

let work = sources
  .map((p) => ({ src: p, out: outPathFor(p) }))
  .filter(({ src, out }) => {
    if (filesGlob && !src.includes(filesGlob.replace(/\*+/g, '').replace(/\/+$/, ''))) return false;
    if (!fs.existsSync(out)) return true;
    if (changedOnly) return fs.statSync(src).mtimeMs > fs.statSync(out).mtimeMs;
    return fs.statSync(src).mtimeMs > fs.statSync(out).mtimeMs;
  })
  .slice(0, limit);

console.log(`${work.length} files to translate to ${language} (model: ${MODEL})`);

const failures = [];
let done = 0;
let i = 0;
async function worker() {
  while (i < work.length) {
    const { src, out } = work[i++];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (src.endsWith('.mdx')) await translateMdx(src, out);
        else await translateMeta(src, out);
        break;
      } catch (e) {
        if (attempt === 2) failures.push({ src, error: String(e.message) });
        else if (String(e.message).startsWith('cost guardrail')) throw e;
      }
    }
    done++;
    if (done % 25 === 0) {
      console.log(`${done}/${work.length} · $${cost().toFixed(2)} · ${failures.length} failed`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\nDONE: ${done - failures.length}/${work.length} translated`);
console.log(`tokens: ${totalIn} in / ${totalOut} out · cost: $${cost().toFixed(2)}`);
if (failures.length) {
  console.log(`FAILED (${failures.length}):`);
  for (const f of failures) console.log(` - ${f.src}: ${f.error}`);
  process.exitCode = 1;
}
