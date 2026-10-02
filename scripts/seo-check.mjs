// Checks the BUILT site for the things that quietly break search and AI-answer visibility.
//
//   node build.mjs && node scripts/seo-check.mjs
//
// Exits with 1 if anything fails. No dependencies. Run it before every push.
//
// What it checks (every HTML page except 404.html, which is only checked for noindex):
//   - exactly one <title>, meta description, canonical; title <= 60, description <= 155 characters; both unique
//   - hreflang: cs, sk, en and x-default (-> English); every target exists; every target lists the page back
//   - og:url equals the canonical; og:locale matches <html lang>
//   - every JSON-LD block parses, has no offers / aggregateRating / review / price, every {"@id"} reference resolves
//   - FAQ pages: the markup lists the same questions as the page, in the same order
//   - every internal link points at a built page or file, and none at a .html address (except /app-privacy.html)
//   - sitemap.xml: well-formed, lists every page and nothing that does not exist
//   - llms.txt and llms-full.txt: every oriapp.eu address in them exists
//   - Czech and Slovak <title>, meta description and JSON-LD hold no no-break space
//   - no dash characters (en, em) in visible text of the generated pages (the site writes a plain hyphen)
//   - images have width, height and alt; links that open a new tab carry rel="noopener"
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\\/g, '/');
const ORIGIN = 'https://oriapp.eu';
const read = (f) => readFileSync(root + f, 'utf8');
const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
const clean = (s) => String(s).replace(/<[^>]*>/g, '').replace(/ /g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// ── The pages ───────────────────────────────────────────────────────────────
const pageFiles = [
  ...readdirSync(root).filter((f) => f.endsWith('.html') && f !== '404.html'),
  ...['sk', 'en'].flatMap((d) => readdirSync(root + d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`)),
];
const urlOf = (file) => {
  const u = '/' + file;
  if (u.endsWith('/index.html')) return u.slice(0, -'index.html'.length);
  return u === '/app-privacy.html' ? u : u.replace(/\.html$/, '');
};
const pages = Object.fromEntries(pageFiles.map((f) => [urlOf(f), { file: f, html: read(f) }]));
const langOf = (html) => html.match(/<html lang="([^"]+)"/)?.[1];
const LOCALES = { cs: 'cs_CZ', sk: 'sk_SK', en: 'en_GB' };
const exists = (path) => path in pages || (path !== '/' && existsSync(root + path.slice(1)) && !path.endsWith('/'));

const rows = [];
const titles = new Map();
const descriptions = new Map();
for (const [url, { file, html }] of Object.entries(pages)) {
  const row = { url, title: '-', desc: '-', canonical: 'ok', hreflang: 'ok', ld: 'ok' };
  const lang = langOf(html);

  // title, description, canonical
  const t = [...html.matchAll(/<title>([^<]*)<\/title>/g)];
  const d = [...html.matchAll(/<meta name="description" content="([^"]*)"/g)];
  const c = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)];
  if (t.length !== 1) fail(url, `${t.length} <title> tags`);
  if (d.length !== 1) fail(url, `${d.length} meta descriptions`);
  if (c.length !== 1) fail(url, `${c.length} canonical links`);
  const title = decode(t[0]?.[1] ?? ''), desc = decode(d[0]?.[1] ?? '');
  row.title = title.length; row.desc = desc.length;
  if (title.length > 60) fail(url, `title is ${title.length} characters (max 60)`);
  if (desc.length > 155) fail(url, `description is ${desc.length} characters (max 155)`);
  if (titles.has(title)) fail(url, `same title as ${titles.get(title)}`); titles.set(title, url);
  if (descriptions.has(desc)) fail(url, `same description as ${descriptions.get(desc)}`); descriptions.set(desc, url);
  if (c[0] && c[0][1] !== ORIGIN + url) { fail(url, `canonical is ${c[0][1]}, expected ${ORIGIN + url}`); row.canonical = 'BAD'; }
  // (the hand-written app policy has no robots meta, which means index)
  const robotsMeta = html.match(/<meta name="robots" content="([^"]*)"/)?.[1];
  if (robotsMeta ? !/^index/.test(robotsMeta) : url !== '/app-privacy.html') fail(url, `robots meta is "${robotsMeta}", not "index"`);

  // share tags
  const ogUrl = html.match(/<meta property="og:url" content="([^"]*)"/)?.[1];
  if (ogUrl && ogUrl !== c[0]?.[1]) fail(url, `og:url ${ogUrl} differs from the canonical`);
  const ogLocale = html.match(/<meta property="og:locale" content="([^"]*)"/)?.[1];
  if (ogLocale && ogLocale !== LOCALES[lang]) fail(url, `og:locale ${ogLocale} does not match lang ${lang}`);

  // hreflang
  const hl = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => [m[1], m[2]]);
  if (hl.length) {
    const codes = hl.map((x) => x[0]).sort().join();
    if (codes !== 'cs,en,sk,x-default') { fail(url, `hreflang set is ${codes}`); row.hreflang = 'BAD'; }
    const xd = hl.find((x) => x[0] === 'x-default')?.[1], en = hl.find((x) => x[0] === 'en')?.[1];
    if (xd !== en) { fail(url, 'x-default is not the English page'); row.hreflang = 'BAD'; }
    for (const [code, href] of hl) {
      const path = href.replace(ORIGIN, '');
      if (!href.startsWith(ORIGIN) || !(path in pages)) { fail(url, `hreflang ${code} points at ${href}, which is not a built page`); row.hreflang = 'BAD'; continue; }
      const back = [...pages[path].html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => `${m[1]}=${m[2]}`).sort().join();
      if (back !== hl.map((x) => `${x[0]}=${x[1]}`).sort().join()) { fail(url, `${path} does not list the same hreflang set back`); row.hreflang = 'BAD'; }
    }
  } else if (url !== '/app-privacy.html') { fail(url, 'no hreflang links'); row.hreflang = 'none'; } else row.hreflang = 'n/a';

  // JSON-LD
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    let ld;
    try { ld = JSON.parse(b[1]); } catch (e) { fail(url, `JSON-LD does not parse: ${e.message}`); row.ld = 'BAD'; continue; }
    const ids = new Set(), refs = [];
    const walk = (v, own) => {
      if (Array.isArray(v)) return v.forEach((x) => walk(x));
      if (!v || typeof v !== 'object') return;
      const keys = Object.keys(v);
      for (const k of keys) if (['offers', 'aggregateRating', 'review', 'price'].includes(k)) { fail(url, `JSON-LD has "${k}"`); row.ld = 'BAD'; }
      if (keys.length === 1 && keys[0] === '@id') refs.push(v['@id']);
      else { if (v['@id']) ids.add(v['@id']); keys.forEach((k) => walk(v[k])); }
    };
    walk(ld['@graph'] ?? ld);
    for (const r of refs) if (!ids.has(r)) { fail(url, `JSON-LD references ${r}, which has no node`); row.ld = 'BAD'; }
    if (/<script/i.test(b[1])) fail(url, 'JSON-LD holds an unescaped <script');
    if (['cs', 'sk'].includes(lang) && / |&nbsp;/.test(b[1])) { fail(url, 'JSON-LD holds a no-break space'); row.ld = 'BAD'; }
  }
  if (!blocks.length && url !== '/app-privacy.html' && !/\/privacy$/.test(url)) { fail(url, 'no JSON-LD'); row.ld = 'none'; }
  if (blocks.length > 1) fail(url, `${blocks.length} JSON-LD blocks (expected 1)`);
  if (['cs', 'sk'].includes(lang) && / |&nbsp;/.test(title + desc)) fail(url, 'title or description holds a no-break space');

  // the homepage headline stays in the title
  if (/^\/(sk\/|en\/)?$/.test(url)) {
    const h1 = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '').replace(/\.$/, '');
    if (!h1 || !title.replace(/ /g, ' ').toLowerCase().includes(h1.toLowerCase())) fail(url, `the headline "${h1}" is not in the title`);
  }

  // links and images
  // The hand-written app policy is left as it is (it links the website policy as /privacy.html, which works).
  for (const m of url === '/app-privacy.html' ? [] : html.matchAll(/<a\b([^>]*)>/g)) {
    const href = m[1].match(/href="([^"]*)"/)?.[1];
    if (!href || /^(mailto:|tel:|#)/.test(href)) continue;
    if (/^https?:\/\//.test(href) && !href.startsWith(ORIGIN)) {
      if (/target="_blank"/.test(m[1]) && !/rel="[^"]*noopener/.test(m[1])) fail(url, `external link without rel="noopener": ${href}`);
      continue;
    }
    const path = href.replace(ORIGIN, '').split('#')[0].split('?')[0];
    if (!path) continue;
    if (/\.html$/.test(path) && path !== '/app-privacy.html') fail(url, `link to a .html address: ${href}`);
    else if (!exists(path)) fail(url, `link to a page that does not exist: ${href}`);
  }
  for (const m of html.matchAll(/<img\b([^>]*)>/g)) {
    if (!/\swidth="/.test(m[1]) || !/\sheight="/.test(m[1]) || !/\salt="/.test(m[1])) fail(url, `image without width, height or alt: ${m[1].slice(0, 60)}`);
  }

  // no dash characters in what a reader sees (the generated pages; the hand-written app policy is left alone)
  if (url !== '/app-privacy.html') {
    const visible = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ');
    const dash = visible.match(/.{0,30}[–—].{0,30}/);
    if (dash) fail(url, `dash character in the text: "${dash[0].trim()}"`);
  }

  // FAQ: the markup lists the page's questions, in order
  if (/<details class="faq-item/.test(html)) {
    const faq = JSON.parse(blocks[0][1])['@graph'].find((n) => n['@type'] === 'FAQPage');
    const visible = [...html.matchAll(/<summary><span>([\s\S]*?)<\/span>[\s\S]*?<div class="faq-body"><div><p>([\s\S]*?)<\/p>/g)].map((m) => [clean(m[1]), clean(m[2])]);
    if (!faq || faq.mainEntity.length !== visible.length) fail(url, `FAQ markup has ${faq?.mainEntity.length} questions, the page ${visible.length}`);
    else faq.mainEntity.forEach((q, i) => { if (clean(q.name) !== visible[i][0]) fail(url, `FAQ question ${i + 1} differs between markup and page`); });
  }
  rows.push(row);
}

// 404 keeps out of the index
if (!/noindex/.test(read('404.html'))) fail('/404.html', 'is not noindex');

// ── sitemap.xml ─────────────────────────────────────────────────────────────
const sitemap = read('sitemap.xml');
{
  const stack = [];
  for (const m of sitemap.matchAll(/<(\/?)([\w:]+)([^>]*?)(\/?)>/g)) {
    if (m[4] || m[2] === 'xml') continue;
    if (m[1]) { if (stack.pop() !== m[2]) fail('sitemap.xml', `mismatched tag </${m[2]}>`); } else stack.push(m[2]);
  }
  if (stack.length) fail('sitemap.xml', 'unclosed tags: ' + stack.join(','));
}
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const l of locs) if (!(l.replace(ORIGIN, '') in pages)) fail('sitemap.xml', `lists ${l}, which is not a built page`);
for (const u of Object.keys(pages)) if (!locs.includes(ORIGIN + u)) fail('sitemap.xml', `misses ${u}`);
if (new Set(locs).size !== locs.length) fail('sitemap.xml', 'lists an address twice');
const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
if (lastmods.length !== locs.length || lastmods.some((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x))) fail('sitemap.xml', 'a lastmod is missing or not YYYY-MM-DD');

// ── llms.txt, llms-full.txt, robots.txt, security.txt ───────────────────────
for (const f of ['llms.txt', 'llms-full.txt']) {
  const text = read(f);
  if (/\r/.test(text)) fail(f, 'has CR characters');
  for (const m of text.matchAll(/https:\/\/oriapp\.eu(\/[^\s)>"]*)?/g)) {
    const path = (m[1] ?? '/').split('#')[0].replace(/[.,;:]+$/, '');
    if (!exists(path)) fail(f, `names ${m[0]}, which does not exist`);
    if (/\.html$/.test(path) && path !== '/app-privacy.html') fail(f, `names a .html address: ${m[0]}`);
  }
}
const robots = read('robots.txt');
if (!/^Sitemap: https:\/\/oriapp\.eu\/sitemap\.xml/m.test(robots)) fail('robots.txt', 'no Sitemap line');
if (/^Disallow:\s*\//m.test(robots)) fail('robots.txt', 'disallows something');
const exp = read('.well-known/security.txt').match(/^Expires: (.+)$/m)?.[1];
if (!exp || new Date(exp) <= new Date()) fail('security.txt', `Expires ${exp} is not in the future`);
if (!existsSync(root + 'favicon.ico')) fail('/favicon.ico', 'is missing');

// ── Report ──────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('page', 52) + pad('title', 7) + pad('desc', 6) + pad('canonical', 11) + pad('hreflang', 9) + 'JSON-LD');
for (const r of rows) console.log(pad(r.url, 52) + pad(r.title, 7) + pad(r.desc, 6) + pad(r.canonical, 11) + pad(r.hreflang, 9) + r.ld);
console.log(`\n${rows.length} pages, ${locs.length} sitemap entries`);
if (problems.length) {
  console.log(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems) console.log(' - ' + p);
  process.exit(1);
}
console.log('seo-check: all good');
