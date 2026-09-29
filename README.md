# oriapp.eu

The public website for Ori - one static page, no build step, served by GitHub Pages.

| File | What it is |
|---|---|
| `index.html` | the page |
| `styles.css` | the app's design system (AURA, dark), as a stylesheet |
| `main.js` | the waitlist form and the one arrival animation |
| `privacy.html` | the privacy notice for this site and its waitlist |
| `404.html`, `robots.txt`, `sitemap.xml` | the usual |
| `assets/` | icons and the social preview image |

**The waitlist** writes to the `waitlist` table of Ori's live Supabase project with its public key, which may only add an address. The table is defined in the app repository (`supabase/migrations/20260929170000_website_waitlist.sql`); `tests/waitlist-check.mjs` there proves what the key can and cannot do.

**Preview locally:** open `index.html` in a browser, or `npx serve .` in this folder.

**Publishing:** every push to `main` goes live. The custom domain is set by the `CNAME` file
(`oriapp.eu`) and in Settings → Pages.
