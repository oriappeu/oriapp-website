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
// Placeholders: {{a.b}} is a text from the language file (it may carry inline
// HTML, e.g. the gold phrase of a headline); {{@name}} is filled in here -
// lang, locale, canonical, alternates, switch, home, privacy, faq_page,
// faq_items, faq_schema, og_image, i18n.
// A missing text, or a key one language has and another lacks, stops the build.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ORIGIN = 'https://oriapp.eu';
const LANGS = [
  { code: 'cs', root: '/', locale: 'cs_CZ', label: 'CS', name: 'Čeština', og: '/assets/og-cs.png' },
  { code: 'sk', root: '/sk/', locale: 'sk_SK', label: 'SK', name: 'Slovenčina', og: '/assets/og-sk.png' },
  { code: 'en', root: '/en/', locale: 'en_GB', label: 'EN', name: 'English', og: '/assets/og-image.png' },
];
// `path` is where the page sits inside a language's root.
const PAGES = [
  { src: 'src/index.html', path: '' },
  { src: 'src/privacy.html', path: 'privacy.html' },
  { src: 'src/faq.html', path: 'faq.html' },
];

const words = Object.fromEntries(LANGS.map((l) => [l.code, JSON.parse(readFileSync(`i18n/${l.code}.json`, 'utf8'))]));

// Czech and Slovak typography: a one-letter preposition or conjunction never
// ends a line (k, s, v, z, o, u, a, i). A no-break space ties it to the next word.
// Run twice, so a pair in a row ("a v") is tied too.
const NBSP = ' ';
const tie = (v) => typeof v === 'string' ? v.replace(/(^|[\s(> ])([ksvzouaiKSVZOUAI]) /g, `$1$2${NBSP}`)
  : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tie(x)]));
for (const code of ['cs', 'sk']) words[code] = tie(tie(words[code]));

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
const plain = (html) => html.replace(/<[^>]*>/g, '').replace(/ /g, ' ');

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
        `<link rel="alternate" hreflang="x-default" href="${ORIGIN}${url(LANGS[0], page)}">`,
      ].join('\n  '),
      switch: `<div class="lang" role="group" aria-label="${t.nav.lang}">${LANGS.map((l) =>
        `<a href="${url(l, page)}" hreflang="${l.code}" lang="${l.code}" title="${l.name}"${l === lang ? ' aria-current="page"' : ''}>${l.label}</a>`).join('')}</div>`,
      // The form's messages, for main.js. `<` is escaped so no text can close the script tag.
      i18n: JSON.stringify(t.js).replace(/</g, '\\u003c'),
      // The questions: native <details>, so they open without script and for every reader.
      faq_page: `${lang.root}faq.html`,
      faq_items: faqItems(t).map(({ q, a }) =>
        `<details class="faq-item reveal"><summary><span>${q}</span><i aria-hidden="true"></i></summary><div class="faq-body"><div><p>${a}</p></div></div></details>`).join('\n          '),
      // The same questions for search engines (schema.org FAQPage).
      faq_schema: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: lang.code,
        mainEntity: faqItems(t).map(({ q, a }) => ({
          '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a) },
        })),
      }).replace(/</g, '\\u003c'),
    };
    const fill = (html) => html.replace(/\{\{\s*(@?[\w.]+)\s*\}\}/g, (_, key) => {
      const value = key.startsWith('@') ? special[key.slice(1)] : lookup(t, key);
      if (typeof value !== 'string') throw new Error(`${page.src} [${lang.code}]: no text for {{${key}}}`);
      return value;
    });
    // Twice: a text may itself carry a placeholder (a link to the privacy page).
    let html = fill(fill(template));
    if (/\{\{/.test(html)) throw new Error(`${page.src} [${lang.code}]: a placeholder was left unfilled`);
    html = html.replace('<!doctype html>\n', `<!doctype html>\n<!-- Generated by build.mjs from ${page.src} and i18n/${lang.code}.json - edit those, not this file. -->\n`);
    const out = `${lang.root.slice(1)}${page.path || 'index.html'}`;
    mkdirSync(dirname(out) || '.', { recursive: true });
    writeFileSync(out, html);
    console.log(`wrote ${out}`);
  }
}

// The sitemap names every page in every language, each with its siblings.
const today = new Date().toISOString().slice(0, 10);
const entries = PAGES.flatMap((page) => LANGS.map((lang) => [
  '  <url>',
  `    <loc>${ORIGIN}${url(lang, page)}</loc>`,
  `    <lastmod>${today}</lastmod>`,
  ...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${ORIGIN}${url(l, page)}"/>`),
  '  </url>',
].join('\n')));
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`);
console.log('wrote sitemap.xml');
