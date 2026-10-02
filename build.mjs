// Builds the site's three languages from one template per page.
//
//   node build.mjs
//
// src/*.html holds the markup with {{key}} placeholders; i18n/<lang>.json holds
// the words. Czech is the default and lives at the root (/), Slovak at /sk/,
// English at /en/. The generated pages are committed - GitHub Pages serves the
// repository as it is, with no build of its own. Edit src/ and i18n/, never
// the generated files; run this, then commit both.
//
// Partials: {{>top}} and {{>footer}} are src/_top.html and src/_footer.html.
// Placeholders: {{a.b}} is a text from the language file (it may carry inline
// HTML, e.g. the gold phrase of a headline); {{@name}} is filled in here -
// lang, locale, canonical, alternates, switch, home, privacy, faq_page,
// faq_items, jsonld, og_alternates, og_image, i18n, guide_plan, guide_compare.
// A missing text, or a key one language has and another lacks, stops the build.
//
// Guides (long-form pages): content/articles.json lists them (slug per language, title,
// description); content/<id>.<lang>.md is the text, in the small Markdown subset that
// markdown.mjs understands. All of them use src/article.html.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { structuredData, clean } from './structured-data.mjs';
import { markdown } from './markdown.mjs';

const ORIGIN = 'https://oriapp.eu';
const LANGS = [
  { code: 'cs', root: '/', locale: 'cs_CZ', label: 'CS', name: 'Čeština', og: '/assets/og-cs.png' },
  { code: 'sk', root: '/sk/', locale: 'sk_SK', label: 'SK', name: 'Slovenčina', og: '/assets/og-sk.png' },
  { code: 'en', root: '/en/', locale: 'en_GB', label: 'EN', name: 'English', og: '/assets/og-image.png' },
];
const ARTICLES = JSON.parse(readFileSync('content/articles.json', 'utf8'));
// `path` is where the page sits inside a language's root; a guide has its own slug per language (`paths`).
const PAGES = [
  { src: 'src/index.html', path: '', kind: 'home' },
  { src: 'src/faq.html', path: 'faq.html', kind: 'faq' },
  { src: 'src/privacy.html', path: 'privacy.html' },
  ...Object.entries(ARTICLES).map(([id, a]) => ({
    src: 'src/article.html',
    kind: 'article',
    id,
    paths: Object.fromEntries(Object.entries(a.paths).map(([code, slug]) => [code, `${slug}.html`])),
  })),
];

// Founders' own profile links (LinkedIn and the like) for the structured data's sameAs.
const PROFILES = JSON.parse(readFileSync('profiles.json', 'utf8'));

// When a page last changed, for its structured data and the sitemap. The date is today if the
// page as built now differs from the committed one (or is new), else the date of the commit that
// last touched it - so a rebuild that changes nothing does not claim a change, and an edit to
// one page does not move the date of the others. The date itself is left out of the comparison.
const localToday = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time, like git's %cs
const DATE_TOKEN = '@@MODIFIED@@';
const withoutDate = (s) => s.replace(/\r\n/g, '\n').replace(/"dateModified": "[^"]*"/g, '"dateModified": "-"');
function pageModified(file, html) {
  try {
    execSync(`git ls-files --error-unmatch -- "${file}"`, { stdio: 'ignore' });
    const committed = execSync(`git show "HEAD:${file}"`, { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });
    if (withoutDate(committed) === withoutDate(html)) {
      return execSync(`git log -1 --format=%cs -- "${file}"`, { encoding: 'utf8' }).trim() || localToday();
    }
  } catch { /* untracked or no history yet: it is new */ }
  return localToday();
}
// A file that is not generated (the app's privacy page): the date of its last commit, or today if edited.
function fileModified(file) {
  try {
    if (execSync(`git status --porcelain -- "${file}"`, { encoding: 'utf8' }).trim()) return localToday();
    return execSync(`git log -1 --format=%cs -- "${file}"`, { encoding: 'utf8' }).trim() || localToday();
  } catch { return localToday(); }
}

const LINKEDIN_MARK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/></svg>';
const profileLink = (key, name, t) => (PROFILES[key]?.[0]
  ? `<a class="in-link" href="${PROFILES[key][0]}" target="_blank" rel="me noopener" aria-label="${name}: ${t.kdo.linkedin}" title="LinkedIn">${LINKEDIN_MARK}</a>`
  : '');

const words = Object.fromEntries(LANGS.map((l) => [l.code, JSON.parse(readFileSync(`i18n/${l.code}.json`, 'utf8'))]));

// Czech and Slovak typography: a one-letter preposition or conjunction never
// ends a line (k, s, v, z, o, u, a, i). A no-break space ties it to the next word.
// Run twice, so a pair in a row ("a v") is tied too.
// Not in what is no running text: page titles, meta descriptions and the structured data's words
// (a no-break space has no place in a <title>, a meta attribute or JSON-LD).
const NBSP = String.fromCharCode(0xA0);
const tieOnce = (s) => s.replace(new RegExp(`(^|[\\s(>${NBSP}])([ksvzouaiKSVZOUAI]) `, 'g'), `$1$2${NBSP}`);
const UNTIED = new Set(['meta', 'seo', 'faq.title', 'faq.description', 'privacy.title', 'privacy.description']);
const tie = (v, path = '') => (UNTIED.has(path) ? v
  : typeof v === 'string' ? tieOnce(tieOnce(v))
  : Array.isArray(v) ? v.map((x, i) => tie(x, `${path}.${i}`))
  : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tie(x, path ? `${path}.${k}` : k)])));
for (const code of ['cs', 'sk']) words[code] = tie(words[code]);

// Every language has exactly the same keys.
const keysOf = (o, pre = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? keysOf(v, `${pre}${k}.`) : [`${pre}${k}`]);
const reference = new Set(keysOf(words.cs));
for (const { code } of LANGS) {
  const own = new Set(keysOf(words[code]));
  const missing = [...reference].filter((k) => !own.has(k));
  const extra = [...own].filter((k) => !reference.has(k));
  if (missing.length || extra.length) {
    throw new Error(`i18n/${code}.json differs from cs.json - missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`);
  }
}

const lookup = (o, key) => key.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const pathOf = (lang, page) => (page.paths ? page.paths[lang.code] : page.path);
// The public address of a page: no .html (GitHub Pages serves /faq as faq.html, and /faq.html still works,
// with its canonical pointing here). The file written to disk keeps its .html name.
const url = (lang, page) => `${lang.root}${pathOf(lang, page).replace(/\.html$/, '')}`;
// faq.items is a list in the JSON (the typography pass turns it into an object keyed 0, 1, 2…).
const faqItems = (t) => Object.values(t.faq.items);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const guide = (id) => PAGES.find((p) => p.id === id);

const modifiedOf = {}; // public URL -> YYYY-MM-DD, for the sitemap
const written = new Set();

for (const page of PAGES) {
  const template = readFileSync(page.src, 'utf8');
  for (const lang of LANGS) {
    const t = words[lang.code];
    const out = `${lang.root.slice(1)}${pathOf(lang, page) || 'index.html'}`;
    if (written.has(out)) throw new Error(`two pages write ${out}`);
    written.add(out);

    // A guide: its text from content/<id>.<lang>.md, its title and description from articles.json.
    let article = null;
    if (page.kind === 'article') {
      const meta = ARTICLES[page.id][lang.code];
      const file = `content/${page.id}.${lang.code}.md`;
      if (!existsSync(file)) throw new Error(`${file} is missing`);
      const md = markdown(readFileSync(file, 'utf8'));
      if (!md.h1) throw new Error(`${file} has no "# " heading`);
      article = {
        id: page.id, h1: clean(md.h1), title: meta.title, description: meta.description,
        published: ARTICLES[page.id].published, mentions: ARTICLES[page.id].mentions,
        body: ['cs', 'sk'].includes(lang.code) ? tie(md.html) : md.html,
      };
    }

    const special = {
      lang: lang.code,
      locale: lang.locale,
      canonical: ORIGIN + url(lang, page),
      home: lang.root,
      privacy: `${lang.root}privacy`,
      og_image: ORIGIN + lang.og,
      alternates: [
        ...LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${ORIGIN}${url(l, page)}">`),
        `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${url(LANGS.find((l) => l.code === 'en'), page)}">`,
      ].join('\n  '),
      // The founders' LinkedIn buttons under their photos; the same profiles.json feeds the structured data.
      linkedin_damian: profileLink('damian', 'Damian Knoth', t),
      linkedin_jindrich: profileLink('jindrich', 'Jindřich Novák', t),
      og_alternates: LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${l.locale}">`).join('\n  '),
      // Structured data for the home, FAQ and guide pages (structured-data.mjs). The date is filled in below.
      jsonld: page.kind ? structuredData({
        kind: page.kind, origin: ORIGIN, pageUrl: ORIGIN + url(lang, page), lang, t, ogImage: ORIGIN + lang.og,
        modified: DATE_TOKEN, profiles: PROFILES, languages: LANGS.map((l) => l.code), article,
      }) : '',
      switch: `<div class="lang" role="group" aria-label="${t.nav.lang}">${LANGS.map((l) =>
        `<a href="${url(l, page)}" hreflang="${l.code}" lang="${l.code}" title="${l.name}"${l === lang ? ' aria-current="page"' : ''}>${l.label}</a>`).join('')}</div>`,
      // The form's messages, for main.js. `<` is escaped so no text can close the script tag.
      i18n: JSON.stringify(t.js).replace(/</g, '\\u003c'),
      // The questions: native <details>, so they open without script and for every reader.
      faq_page: `${lang.root}faq`,
      // The two guides the footer and the "how it works" section point to.
      guide_plan: url(lang, guide('n1')),
      guide_compare: url(lang, guide('n2')),
      // The week's "do you recognise this" lines, and the moving band of what broke the plan
      // (the band's list twice, so it loops without a seam; the second set is hidden on reduced motion).
      recog_items: Object.values(t.week.items).map((li) => `<li>${li}</li>`).join('\n        '),
      band_items: (() => {
        const items = Object.values(t.band.items);
        const set = (cls) => items.map((i) => `<span${cls}>${i}</span>`).join('');
        return set('') + set(' class="dup"');
      })(),
      band_text: Object.values(t.band.items).join(', '),
      faq_items: faqItems(t).map(({ q, a }) =>
        `<details class="faq-item reveal"><summary><span>${q}</span><i aria-hidden="true"></i></summary><div class="faq-body"><div><p>${a}</p></div></div></details>`).join('\n          '),
      ...(article ? { article_title: esc(article.title), article_description: esc(article.description), article_body: article.body } : {}),
    };
    const fill = (html) => html.replace(/\{\{\s*(@?[\w.]+)\s*\}\}/g, (_, key) => {
      const value = key.startsWith('@') ? special[key.slice(1)] : lookup(t, key);
      if (typeof value !== 'string') throw new Error(`${page.src} [${lang.code}]: no text for {{${key}}}`);
      return value;
    });
    // The shared top bar and footer are partials; filled in with the page, twice
    // (a text may itself carry a placeholder, like a link to the privacy page).
    const withPartials = template.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => readFileSync(`src/_${name}.html`, 'utf8').trimEnd());
    let html = fill(fill(withPartials));
    if (/\{\{/.test(html)) throw new Error(`${page.src} [${lang.code}]: a placeholder was left unfilled`);
    html = html.replace('<!doctype html>\n', `<!doctype html>\n<!-- Generated by build.mjs from ${page.src} and i18n/${lang.code}.json - edit those, not this file. -->\n`);
    const modified = pageModified(out, html.split(DATE_TOKEN).join(''));
    html = html.split(DATE_TOKEN).join(modified);
    modifiedOf[ORIGIN + url(lang, page)] = modified;
    mkdirSync(dirname(out) || '.', { recursive: true });
    writeFileSync(out, html);
    console.log(`wrote ${out}`);
  }
}

// The sitemap names every page in every language, each with its siblings. A page's lastmod is the
// date it really last changed (see pageModified).
const entries = PAGES.flatMap((page) => LANGS.map((lang) => [
  '  <url>',
  `    <loc>${ORIGIN}${url(lang, page)}</loc>`,
  `    <lastmod>${modifiedOf[ORIGIN + url(lang, page)]}</lastmod>`,
  ...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${ORIGIN}${url(l, page)}"/>`),
  `    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${url(LANGS.find((l) => l.code === 'en'), page)}"/>`,
  '  </url>',
].join('\n')));
// The app's privacy page is hand-written, English only: one entry, no language siblings.
entries.push(['  <url>', `    <loc>${ORIGIN}/app-privacy.html</loc>`, `    <lastmod>${fileModified('app-privacy.html')}</lastmod>`, '  </url>'].join('\n'));
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`);
console.log('wrote sitemap.xml');
