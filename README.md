# oriapp.eu

The public website for Ori - static pages in three languages, served by GitHub Pages.
Czech is the default at `/`, Slovak at `/sk/`, English at `/en/`.

| File | What it is |
|---|---|
| `src/index.html`, `src/faq.html`, `src/privacy.html` | the page templates - markup with `{{key}}` placeholders |
| `src/_top.html`, `src/_footer.html` | the top bar and footer every page shares (`{{>top}}`, `{{>footer}}`) |
| `i18n/cs.json`, `sk.json`, `en.json` | every word on the site, one file per language |
| `build.mjs` | writes the finished pages from the two above |
| `index.html`, `faq.html`, `privacy.html`, `sk/…`, `en/…`, `sitemap.xml` | **generated** - never edit by hand |
| `styles.css` | the app's design system (AURA, dark), as a stylesheet |
| `main.js` | the waitlist form and all the motion |
| `fonts/` | Sora and Manrope, served from here (no Google Fonts request) |
| `img/` | the app screenshots (first week) and the founders' photos |
| `app-privacy.html` | the Ori app's privacy policy, hand-written, English only, outside the build |
| `404.html`, `robots.txt` | the usual |
| `assets/` | icons and the social preview images (`og-cs.png`, `og-sk.png`, `og-image.png` for English) |

**Changing a text:** edit it in `i18n/<lang>.json` (all three languages must keep the same keys - the
build stops otherwise), run `node build.mjs`, commit the JSON and the generated pages together.
Czech and Slovak one-letter prepositions (k, s, v, z, o, u, a, i) are tied to the next word by the build.
House rules for the copy: no dashes inside sentences, one register (informal "you"), and no claim the
founders have not confirmed (pricing is still open, so nothing says the app is free).

**The page** (2026-10-01 redesign): hero with the animated phone, "Poznáváš se?" (a week where the plan
breaks, which plays once when scrolled to), a quiet band of what breaks plans, the interactive model of the
app, the first week on real screenshots with a gold route that follows the scroll, the founders, the
sign-up. The screenshots in `img/day*.webp` come from the hosted app on a seeded test account.

**The waitlist** writes to the `waitlist` table of Ori's live Supabase project with its public key, which
may only add an address; the backend then sends the thank-you email. Both are defined in the app repository
(`supabase/migrations/20260929170000_website_waitlist.sql`, `20260929210000_waitlist_welcome.sql`,
`backend/lib/waitlistWelcome.js`); `tests/waitlist-check.mjs` and `tests/waitlist-welcome-check.mjs` there
prove what the key can and cannot do.

**Preview locally:** the pages use absolute paths (`/styles.css`), so serve the folder rather than opening
a file: `npx serve .` in this folder.

**Publishing:** every push to `main` goes live. The custom domain is set by the `CNAME` file
(`oriapp.eu`) and in Settings → Pages.

**Going back to the previous design:** the site as it was before the redesign (cards, eyebrows, the
marquee) is the tag `pre-redesign`. To restore it without losing history:
`git revert -m 1 <the redesign merge commit>` and push, or
`git checkout pre-redesign -- .`, run `node build.mjs`, commit and push.
