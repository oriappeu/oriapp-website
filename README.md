# oriapp.eu

The public website for Ori - static pages in three languages, served by GitHub Pages.
Czech is the default at `/`, Slovak at `/sk/`, English at `/en/`.

| File | What it is |
|---|---|
| `src/index.html`, `src/privacy.html` | the page templates - markup with `{{key}}` placeholders |
| `i18n/cs.json`, `sk.json`, `en.json` | every word on the site, one file per language |
| `build.mjs` | writes the finished pages from the two above |
| `index.html`, `privacy.html`, `sk/…`, `en/…`, `sitemap.xml` | **generated** - never edit by hand |
| `styles.css` | the app's design system (AURA, dark), as a stylesheet |
| `main.js` | the waitlist form and the motion |
| `fonts/` | Sora and Manrope, served from here (no Google Fonts request) |
| `404.html`, `robots.txt` | the usual |
| `assets/` | icons and the social preview images (`og-cs.png`, `og-sk.png`, `og-image.png` for English) |

**Changing a text:** edit it in `i18n/<lang>.json` (all three languages must keep the same keys - the
build stops otherwise), run `node build.mjs`, commit the JSON and the generated pages together.
Czech and Slovak one-letter prepositions (k, s, v, z, o, u, a, i) are tied to the next word by the build.

**The waitlist** writes to the `waitlist` table of Ori's live Supabase project with its public key, which
may only add an address. The table is defined in the app repository
(`supabase/migrations/20260929170000_website_waitlist.sql`); `tests/waitlist-check.mjs` there proves what
the key can and cannot do.

**Preview locally:** the pages use absolute paths (`/styles.css`), so serve the folder rather than opening
a file: `npx serve .` in this folder.

**Publishing:** every push to `main` goes live. The custom domain is set by the `CNAME` file
(`oriapp.eu`) and in Settings → Pages.
