// Structured data (schema.org JSON-LD) for the home, FAQ and guide pages.
//
// What it is: a block of machine-readable labels in each page's <head> that tells
// Google and AI search tools who Ori is (a company, an app, two founders, a FAQ).
// It does not raise rankings by itself; it makes the site understandable and
// quotable, and makes some rich results possible (the logo, breadcrumbs).
//
// Built from the same word files as the page (i18n/<lang>.json, section `seo`,
// plus the hero headline, the meta title and description and the FAQ), so a text
// change cannot leave the labels saying something the page no longer says. Every
// entity has one stable @id, the same on every page and in every language, so
// search engines merge them into one picture instead of nine.
//
// The first version of this came from the marketing package (oriapp-seo.zip,
// 2026-10-01), rewritten against the redesigned site. Things only the founders can
// add live in profiles.json (LinkedIn and the like -> `sameAs`) and later: store
// links, price, ratings, legal entity (see README).

const KNOWS_ABOUT = ['AI coaching', 'personal development', 'goal setting', 'habit formation', 'behaviour change', 'burnout prevention', 'adaptive planning'];
const EMAIL = 'oriapp.eu@gmail.com';

/** Plain text: no tags, no no-break spaces, one line. */
export const clean = (s) => String(s).replace(/<[^>]*>/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/**
 * @param {object} o
 * @param {'home'|'faq'|'article'} o.kind
 * @param {string} o.origin       https://oriapp.eu
 * @param {string} o.pageUrl      this page, absolute
 * @param {{code:string, root:string}} o.lang
 * @param {object} o.t            the language's words
 * @param {string} o.ogImage      absolute URL of the share image
 * @param {string} o.modified     YYYY-MM-DD, when the content last changed
 * @param {object} o.profiles     { organization: [], damian: [], jindrich: [] } URLs
 * @param {string[]} o.languages  every language code of the site
 * @param {object} [o.article]    for kind 'article': { h1, title, description, published, mentions }
 * @returns {string} JSON, safe inside a <script> tag
 */
export function structuredData({ kind, origin, pageUrl, lang, t, ogImage, modified, profiles, languages, article }) {
  const id = (name) => `${origin}/#${name}`;
  const s = t.seo;
  const sameAs = (key) => (Array.isArray(profiles?.[key]) && profiles[key].length ? { sameAs: profiles[key] } : {});

  const organization = {
    '@type': 'Organization',
    '@id': id('organization'),
    name: 'Ori',
    alternateName: ['Ori app', 'Ori AI goal coach', 'oriapp.eu'],
    url: `${origin}/`,
    logo: { '@type': 'ImageObject', '@id': id('logo'), url: `${origin}/assets/icon-512.png`, width: 512, height: 512, caption: 'Ori' },
    image: { '@id': id('logo') },
    description: clean(s.org_description),
    disambiguatingDescription: clean(s.disambiguation),
    slogan: clean(t.hero.h1),
    email: EMAIL,
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: EMAIL, availableLanguage: languages },
    foundingDate: '2026',
    founder: [{ '@id': id('damian-knoth') }, { '@id': id('jindrich-novak') }],
    areaServed: [{ '@type': 'Country', name: 'Czech Republic', identifier: 'CZ' }, { '@type': 'Country', name: 'Slovakia', identifier: 'SK' }],
    knowsAbout: KNOWS_ABOUT,
    ...sameAs('organization'),
  };

  const website = {
    '@type': 'WebSite',
    '@id': id('website'),
    url: `${origin}/`,
    name: 'Ori',
    alternateName: 'oriapp.eu',
    publisher: { '@id': id('organization') },
    inLanguage: languages,
  };

  // The app is English for now (the FAQ says so), whatever language the page is in.
  const app = {
    '@type': 'MobileApplication',
    '@id': id('app'),
    name: 'Ori',
    alternateName: clean(s.app_alt),
    description: clean(s.app_description),
    disambiguatingDescription: clean(s.disambiguation),
    url: `${origin}/`,
    image: ogImage,
    applicationCategory: 'LifestyleApplication',
    applicationSubCategory: clean(s.app_sub),
    operatingSystem: 'Android, iOS',
    inLanguage: 'en',
    countriesSupported: ['CZ', 'SK'],
    featureList: Object.values(s.features).map(clean),
    audience: { '@type': 'Audience', audienceType: clean(s.audience) },
    keywords: clean(s.keywords),
    creator: { '@id': id('organization') },
    publisher: { '@id': id('organization') },
  };

  const person = (slug, name, jobTitle, description, photo, key) => ({
    '@type': 'Person',
    '@id': id(slug),
    name,
    jobTitle,
    description: clean(description),
    image: `${origin}/img/${photo}`,
    worksFor: { '@id': id('organization') },
    ...sameAs(key),
  });

  let nodes;
  if (kind === 'home') {
    nodes = [
      organization,
      website,
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: clean(t.meta.title),
        description: clean(t.meta.description),
        inLanguage: lang.code,
        isPartOf: { '@id': id('website') },
        about: { '@id': id('app') },
        mainEntity: { '@id': id('app') },
        publisher: { '@id': id('organization') },
        primaryImageOfPage: { '@type': 'ImageObject', url: ogImage, width: 1200, height: 630 },
        dateModified: modified,
      },
      app,
      person('damian-knoth', 'Damian Knoth', 'CEO', s.damian, 'founder-b.jpg', 'damian'),
      person('jindrich-novak', 'Jindřich Novák', 'CTO', s.jindrich, 'founder-a.jpg', 'jindrich'),
    ];
  } else if (kind === 'article') {
    // A guide: the article and its breadcrumb, then the shared company, site, app and founders, so that
    // author and publisher resolve on the page itself.
    const names = [
      {
        '@type': 'Article',
        '@id': `${pageUrl}#article`,
        headline: article.h1,
        description: clean(article.description),
        inLanguage: lang.code,
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        image: ogImage,
        datePublished: article.published,
        dateModified: modified,
        author: { '@id': id('organization') },
        publisher: { '@id': id('organization') },
        isPartOf: { '@id': id('website') },
        // The comparison names the tools it compares (name and official address, nothing else).
        mentions: [{ '@id': id('app') }, ...(article.mentions || []).map((m) => ({ '@type': 'Thing', name: m.name, url: m.url }))],
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ori', item: `${origin}${lang.root}` },
          { '@type': 'ListItem', position: 2, name: article.h1, item: pageUrl },
        ],
      },
    ];
    nodes = [
      ...names,
      organization,
      website,
      app,
      person('damian-knoth', 'Damian Knoth', 'CEO', s.damian, 'founder-b.jpg', 'damian'),
      person('jindrich-novak', 'Jindřich Novák', 'CTO', s.jindrich, 'founder-a.jpg', 'jindrich'),
    ];
  } else {
    nodes = [
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: clean(t.faq.title),
        description: clean(t.faq.description),
        inLanguage: lang.code,
        isPartOf: { '@id': id('website') },
        about: { '@id': id('app') },
        publisher: { '@id': id('organization') },
        dateModified: modified,
        // What the page shows, as plain text. Where an answer links to a guide, `ld` (i18n) is the same answer with
        // the guide's address written out, so a reader of the markup alone gets the address too.
        mainEntity: Object.values(t.faq.items).map(({ q, a, ld }) => ({
          '@type': 'Question',
          name: clean(q),
          acceptedAnswer: { '@type': 'Answer', text: clean(ld ?? a) },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ori', item: `${origin}${lang.root}` },
          { '@type': 'ListItem', position: 2, name: clean(s.crumb_faq), item: pageUrl },
        ],
      },
      website,
      organization,
      app,
      // The company points at its founders, so they are defined here too: each page stands on its own.
      person('damian-knoth', 'Damian Knoth', 'CEO', s.damian, 'founder-b.jpg', 'damian'),
      person('jindrich-novak', 'Jindřich Novák', 'CTO', s.jindrich, 'founder-a.jpg', 'jindrich'),
    ];
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }, null, 2).replace(/</g, '\\u003c');
}
