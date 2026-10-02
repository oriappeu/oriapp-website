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
// faq_items, jsonld, og_alternates, og_image, i18n.
// A missing text, or a key one language has and another lacks, stops the build.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { structuredData } from './structured-data.mjs';

const ORIGIN = 'https://oriapp.eu';
const LANGS = [
  { code: 'cs', root: '/', locale: 'cs_CZ', label: 'CS', name: 'Čeština', og: '/assets/og-cs.png' },
  { code: 'sk', root: '/sk/', locale: 'sk_SK', label: 'SK', name: 'Slovenčina', og: '/assets/og-sk.png' },
  { code: 'en', root: '/en/', locale: 'en_GB', label: 'EN', name: 'English', og: '/assets/og-image.png' },
];
// `path` is where the page sits inside a language's root.
const PAGES = [
  { src: 'src/index.html', path: '', kind: 'home' },
  { src: 'src/privacy.html', path: 'privacy.html' },
  { src: 'src/faq.html', path: 'faq.html', kind: 'faq' },
];

// Founders' own profile links (LinkedIn and the like) for the structured data's sameAs.
const PROFILES = JSON.parse(readFileSync('profiles.json', 'utf8'));

// When the content last changed: today if there are uncommitted edits to what the pages
// are made of, else the date of the last commit that touched it. Honest for crawlers
// (a rebuild that changes nothing does not claim a change).
function modifiedDate() {
  const today = new Date().toISOString().slice(0, 10);
  const content = 'src i18n img profiles.json structured-data.mjs';
  try {
    if (execSync(`git status --porcelain -- ${content}`, { encoding: 'utf8' }).trim()) return today;
    return execSync(`git log -1 --format=%cs -- ${content}`, { encoding: 'utf8' }).trim() || today;
  } catch { return today; }
}
const MODIFIED = modifiedDate();

const LINKEDIN_MARK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/></svg>';
const profileLink = (key, name, t) => (PROFILES[key]?.[0]
  ? `<a class="in-link" href="${PROFILES[key][0]}" target="_blank" rel="me noopener" aria-label="${name}: ${t.kdo.linkedin}" title="LinkedIn">${LINKEDIN_MARK}</a>`
  : '');

const words = Object.fromEntries(LANGS.map((l) => [l.code, JSON.parse(readFileSync(`i18n/${l.code}.json`, 'utf8'))]));

// Czech and Slovak typography: a one-letter preposition or conjunction never
// ends a line (k, s, v, z, o, u, a, i). A no-break space ties it to the next word.
// Run twice, so a pair in a row ("a v") is tied too.
const NBSP = String.fromCharCode(0xA0);
const tieOnce = (s) => s.replace(new RegExp(`(^|[\\s(>${NBSP}])([ksvzouaiKSVZOUAI]) `, 'g'), `$1$2${NBSP}`);
const tie = (v) => (typeof v === 'string' ? tieOnce(tieOnce(v))
  : Array.isArray(v) ? v.map(tie)
  : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tie(x)])));
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
const url = (lang, page) => `${lang.root}${page.path}`;
// faq.items is a list in the JSON (the typography pass turns it into an object keyed 0, 1, 2…).
const faqItems = (t) => Object.values(t.faq.items);

for (const page of PAGES) {
  const template = readFileSync(page.src, 'utf8');
  for (const lang of LANGS) {
    const t = words[lang.code];
    const special = {
      lang: lang.code,
      locale: lang.locale,
      canonical: ORIGIN + url(lang, page),
      home: lang.root,
      privacy: `${lang.root}privacy.html`,
      og_image: ORIGIN + lang.og,
      alternates: [
        ...LANGS.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${ORIGIN}${url(l, page)}">`),
        `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${url(LANGS.find((l) => l.code === 'en'), page)}">`,
      ].join('\n  '),
      // The founders' LinkedIn buttons under their photos; the same profiles.json feeds the structured data.
      linkedin_damian: profileLink('damian', 'Damian Knoth', t),
      linkedin_jindrich: profileLink('jindrich', 'Jindřich Novák', t),
      og_alternates: LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${l.locale}">`).join('\n  '),
      // Structured data for the home and FAQ pages (structured-data.mjs).
      jsonld: page.kind ? structuredData({
        kind: page.kind, origin: ORIGIN, pageUrl: ORIGIN + url(lang, page), lang, t, ogImage: ORIGIN + lang.og,
        modified: MODIFIED, profiles: PROFILES, languages: LANGS.map((l) => l.code),
      }) : '',
      switch: `<div class="lang" role="group" aria-label="${t.nav.lang}">${LANGS.map((l) =>
        `<a href="${url(l, page)}" hreflang="${l.code}" lang="${l.code}" title="${l.name}"${l === lang ? ' aria-current="page"' : ''}>${l.label}</a>`).join('')}</div>`,
      // The form's messages, for main.js. `<` is escaped so no text can close the script tag.
      i18n: JSON.stringify(t.js).replace(/</g, '\\u003c'),
      // The questions: native <details>, so they open without script and for every reader.
      faq_page: `${lang.root}faq.html`,
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
    const out = `${lang.root.slice(1)}${page.path || 'index.html'}`;
    mkdirSync(dirname(out) || '.', { recursive: true });
    writeFileSync(out, html);
    console.log(`wrote ${out}`);
  }
}

// The sitemap names every page in every language, each with its siblings.
const entries = PAGES.flatMap((page) => LANGS.map((lang) => [
  '  <url>',
  `    <loc>${ORIGIN}${url(lang, page)}</loc>`,
  `    <lastmod>${MODIFIED}</lastmod>`,
  ...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${ORIGIN}${url(l, page)}"/>`),
  `    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${url(LANGS.find((l) => l.code === 'en'), page)}"/>`,
  '  </url>',
].join('\n')));
// The app's privacy page is hand-written, English only: one entry, no language siblings.
entries.push(['  <url>', `    <loc>${ORIGIN}/app-privacy.html</loc>`, `    <lastmod>${MODIFIED}</lastmod>`, '  </url>'].join('\n'));
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`);
console.log('wrote sitemap.xml');
