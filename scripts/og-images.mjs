// Renders each guide's share image (assets/og-<id>-<lang>.png, 1200×630) in the style of
// assets/og-image.png: the logo, a gold "Guide" label, the guide's heading, the descriptor.
//
//   npm i --no-save playwright && node scripts/og-images.mjs && node build.mjs
//
// Run it again after changing a guide's heading (the first "# " line of content/<id>.<lang>.md).
// build.mjs uses a guide's own image when the file exists, else the language's general one.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const ARTICLES = JSON.parse(readFileSync('content/articles.json', 'utf8'));
const WORDS = {
  cs: { label: 'Návod', descriptor: 'Ori, AI kouč na cíle' },
  sk: { label: 'Návod', descriptor: 'Ori, AI kouč na ciele' },
  en: { label: 'Guide', descriptor: 'Ori, AI goal coach' },
};
const data = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const page = (heading, { label, descriptor }) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Sora; font-weight: 600; src: url(${data('fonts/sora-600-latin.woff2', 'font/woff2')}) format("woff2"); }
@font-face { font-family: Sora; font-weight: 600; src: url(${data('fonts/sora-600-latin-ext.woff2', 'font/woff2')}) format("woff2"); unicode-range: U+0100-024F; }
@font-face { font-family: Manrope; font-weight: 400 700; src: url(${data('fonts/manrope-latin.woff2', 'font/woff2')}) format("woff2"); }
@font-face { font-family: Manrope; font-weight: 400 700; src: url(${data('fonts/manrope-latin-ext.woff2', 'font/woff2')}) format("woff2"); unicode-range: U+0100-024F; }
html, body { margin: 0; width: 1200px; height: 630px; }
body { position: relative; overflow: hidden; color: #fff; font-family: Manrope, sans-serif;
  background: radial-gradient(900px 620px at 0% 0%, #463352 0%, rgba(70, 51, 82, 0) 70%),
              radial-gradient(700px 500px at 100% 100%, #2E2028 0%, rgba(46, 32, 40, 0) 70%), #0F0C14; }
.brand { position: absolute; left: 96px; top: 84px; display: flex; align-items: center; gap: 18px; font: 600 34px Sora; }
.brand img { width: 60px; height: 60px; border-radius: 14px; }
.label { position: absolute; left: 96px; top: 206px; font: 700 22px Manrope; letter-spacing: 0.14em; text-transform: uppercase; color: #E9C464; }
h1 { position: absolute; left: 96px; right: 96px; top: 246px; margin: 0; font: 600 62px/1.12 Sora; letter-spacing: -0.02em; text-wrap: balance; }
.foot { position: absolute; left: 96px; bottom: 84px; font-size: 26px; color: rgba(255, 255, 255, 0.68); }
</style></head><body>
<div class="brand"><img src="${data('assets/icon-192.png', 'image/png')}" alt=""><span>Ori</span></div>
<div class="label">${esc(label)}</div>
<h1>${esc(heading)}</h1>
<div class="foot">${esc(descriptor)} · oriapp.eu</div>
</body></html>`;

// Playwright's own Chromium if it is installed, else the computer's Chrome.
const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }));
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const id of Object.keys(ARTICLES)) {
  for (const code of Object.keys(WORDS)) {
    const heading = readFileSync(`content/${id}.${code}.md`, 'utf8').match(/^# (.+)$/m)?.[1];
    if (!heading) throw new Error(`content/${id}.${code}.md has no "# " heading`);
    await tab.setContent(page(heading, WORDS[code]));
    await tab.evaluate(() => document.fonts.ready);
    // The heading must fit above the footer line: three lines at most.
    const bottom = await tab.evaluate(() => document.querySelector('h1').getBoundingClientRect().bottom);
    if (bottom > 520) throw new Error(`${id}.${code}: the heading is too long for the image`);
    await tab.screenshot({ path: `assets/og-${id}-${code}.png` });
    console.log(`wrote assets/og-${id}-${code}.png`);
  }
}
await browser.close();
