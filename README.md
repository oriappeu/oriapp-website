# oriapp.eu

The public website for Ori - static pages in three languages, served by GitHub Pages.
Czech is the default at `/`, Slovak at `/sk/`, English at `/en/`.

| File | What it is |
|---|---|
| `src/index.html`, `src/faq.html`, `src/privacy.html` | the page templates - markup with `{{key}}` placeholders |
| `src/_top.html`, `src/_footer.html` | the top bar and footer every page shares (`{{>top}}`, `{{>footer}}`) |
| `i18n/cs.json`, `sk.json`, `en.json` | every word on the site, one file per language |
| `build.mjs` | writes the finished pages from the two above |
| `structured-data.mjs`, `profiles.json` | the schema.org markup for the home and FAQ pages, and the founders' profile links it uses |
| `llms.txt`, `llms-full.txt` | plain-language summaries of Ori for AI crawlers: a short index and the full text (hand-written, English) |
| `.well-known/security.txt` | how to report a security problem (RFC 9116) |
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

**In-page links:** the menu, the "join" buttons and the logo scroll within the page (main.js) without leaving a #section name in the address bar; without script they are plain anchors, and a ctrl-click still opens the real link. Section names (jak, kdo, zapis, ...) are Czech words used in all languages.

**Preview locally:** the pages use absolute paths (`/styles.css`), so serve the folder rather than opening
a file: `npx serve .` in this folder.

**Publishing:** every push to `main` goes live. The custom domain is set by the `CNAME` file
(`oriapp.eu`) and in Settings → Pages.

**Structured data (SEO):** every home and FAQ page carries a block of schema.org labels in its head
(who Ori is, the app, the founders, the FAQ) plus hreflang tags (English is the fallback language),
`og:locale:alternate` and a robots meta. `structured-data.mjs` builds the block from the same word files
as the page, so it cannot drift from what the page says; `node build.mjs` regenerates it. It makes the site
understandable and quotable for Google and AI search; it does not raise rankings by itself.
Validate after a change: https://validator.schema.org and https://search.google.com/test/rich-results.
- **Add a profile** (company LinkedIn page, Instagram, TikTok...): put the URL in `profiles.json` under
  `organization`, `damian` or `jindrich`, then build. It appears as `sameAs`. Use the exact same name and
  one-line description on every profile.
- **Later additions** (the marketing package's list): store links (`downloadUrl`, `installUrl`) once the app
  is in a store; `offers` (price) and `aggregateRating` once they exist; the legal entity (`legalName`,
  IČO, address) once incorporated; a 512 px logo is already used; a domain email instead of Gmail.
- `dateModified` and the sitemap's `lastmod` are the date the content last changed (today while there are
  uncommitted edits, else the last commit that touched it).
- `llms.txt` is edited by hand; keep it in line with the site when facts change.
- The marketing package `oriapp-seo.zip` (2026-10-01) was the starting point; it was rewritten against the
  redesigned site (it still carried the old slogan, "check-ins" and a line that Ori is not for team projects).
  The zip is git-ignored and is not part of the site.

**GEO (being found and quoted by AI search):** `robots.txt` welcomes the named AI crawlers and states the
site's content signals (search, AI answers and AI training are all allowed, as it is public marketing
content; change a `yes` to `no` to withdraw). `llms.txt` is the short index and `llms-full.txt` the full text.
**Keep them true:** update both when pricing, the launch date, platforms, the app's language or either privacy
policy change (llms-full.txt repeats the app policy's main points, so it must change in the same step as the
policy). `.well-known/security.txt` expires on 2027-10-01 - bump its `Expires` before then. Every page head
points agents at `llms.txt` (`rel="describedby"`) because GitHub Pages cannot send the `Link` header the
marketing package assumed. Not used on purpose: `.well-known/api-catalog` (Ori has no public API, and this host
cannot give a file without an extension the media type the standard asks for) and `_headers` (Cloudflare and
Netlify only); both would need a different host.
**Pending (last step of the data-system work):** the updated privacy policy for the website and the app, and
Terms of use (marketing package, `Marketing web.zip`, kept outside git). They are not on the site yet.

**Going back to the previous design:** the site as it was before the redesign (cards, eyebrows, the
marquee) is the tag `pre-redesign`. To restore it without losing history:
`git revert -m 1 <the redesign merge commit>` and push, or
`git checkout pre-redesign -- .`, run `node build.mjs`, commit and push.
