// Turns a built page's <main> into Markdown, for the pages that have no Markdown source
// (the home and privacy pages). Only what a reader needs: headings, paragraphs, lists, links,
// bold and italics. Skipped: anything aria-hidden, the forms, scripts, SVGs, buttons, and the
// illustrations (the phone and the demo device, the founders' photos), which are made of
// small labels that read as noise without the picture around them.

const SKIP_TAGS = new Set(['script', 'style', 'svg', 'form', 'button', 'noscript', 'template']);
// `n`: the visual step number in front of a numbered list item (the list numbers itself).
const SKIP_CLASSES = ['hero-visual', 'device', 'photos', 'n'];
const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'wbr']);
const BLOCK = { h1: '# ', h2: '## ', h3: '### ', h4: '#### ', p: '', li: '- ', figcaption: '', blockquote: '> ' };

const decode = (s) => s
  .replace(/&nbsp;| /g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export function htmlToMarkdown(html, origin) {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
  const blocks = [];
  let text = ''; // the block being collected
  let prefix = null; // its Markdown prefix, null when outside a block
  const skip = []; // tag names whose subtree is skipped, innermost last
  const links = []; // open <a> hrefs
  const lists = []; // open lists: a counter for <ol>, null for <ul>
  let gap = false; // a bold label just closed: the text after it starts a new word
  const flush = () => {
    const line = text.replace(/\s+/g, ' ').trim();
    if (prefix !== null && line) blocks.push(prefix + line);
    text = ''; prefix = null;
  };
  for (const [, close, name, attrs, raw] of main.matchAll(/<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g)) {
    if (raw !== undefined) {
      if (skip.length) continue;
      const t = decode(raw);
      if (gap && /^[^\s.,;:!?)]/.test(t)) text += ' ';
      if (t.trim()) gap = false;
      text += t;
      continue;
    }
    const tag = name.toLowerCase();
    if (skip.length) {
      if (!VOID.has(tag) && !/\/$/.test(attrs)) {
        if (close) { if (skip.at(-1) === tag) skip.pop(); else if (skip.includes(tag)) skip.length = skip.lastIndexOf(tag); }
        else skip.push(tag);
      }
      continue;
    }
    if (close) {
      if (tag in BLOCK) flush();
      else if (tag === 'a') { const href = links.pop(); if (href) text += `](${href})`; }
      else if (tag === 'strong' || tag === 'b') { text += '**'; gap = true; }
      else if (tag === 'em' || tag === 'i') text += '*';
      else if (tag === 'ol' || tag === 'ul') lists.pop();
      continue;
    }
    const cls = attrs.match(/class="([^"]*)"/)?.[1] ?? '';
    if (SKIP_TAGS.has(tag) || /aria-hidden="true"/.test(attrs) || SKIP_CLASSES.some((c) => cls.split(/\s+/).includes(c))) {
      // A picture that names itself (the JIC logo: role="img" aria-label="JIC") keeps its name.
      const label = /role="img"/.test(attrs) && attrs.match(/aria-label="([^"]*)"/)?.[1];
      if (label) text += ` ${decode(label)} `;
      if (!VOID.has(tag)) skip.push(tag);
      continue;
    }
    if (tag === 'ol') lists.push(0);
    else if (tag === 'ul') lists.push(null);
    if (tag === 'li' && typeof lists.at(-1) === 'number') { flush(); prefix = `${++lists[lists.length - 1]}. `; }
    else if (tag in BLOCK) { flush(); prefix = BLOCK[tag]; }
    else if (tag === 'br') text += ' ';
    else if (tag === 'a') {
      const href = attrs.match(/href="([^"]*)"/)?.[1];
      // In-page anchors (#zapis) and sign-up links become plain text; real links stay links.
      const keep = href && !href.includes('#');
      links.push(keep ? (href.startsWith('/') ? origin + href : href) : null);
      if (keep) text += '[';
    } else if (tag === 'strong' || tag === 'b') text += '**';
    else if (tag === 'em' || tag === 'i') text += '*';
  }
  flush();
  return blocks.join('\n\n').replace(/\*\*\s*\*\*/g, '').replace(/\[\s*\]\([^)]*\)/g, '') + '\n';
}
