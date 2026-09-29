# oriapp.eu

The public website for Ori — one static page, no build step, served by GitHub Pages.

| File | What it is |
|---|---|
| `index.html` | the page |
| `styles.css` | the app's design system (AURA, dark), as a stylesheet |
| `main.js` | the waitlist form and the one arrival animation |
| `privacy.html` | the privacy notice for this site and its waitlist |
| `404.html`, `robots.txt`, `sitemap.xml` | the usual |
| `assets/` | icons and the social preview image |

**The waitlist** writes to the `waitlist` table of the Supabase project `rqluecojhplvfiytybty`
with its public anon key — the same table the previous site used, so no signup was lost.

**Preview locally:** open `index.html` in a browser, or `npx serve .` in this folder.

**Publishing:** every push to `main` goes live. The custom domain is set by the `CNAME` file
(`oriapp.eu`) and in Settings → Pages.
