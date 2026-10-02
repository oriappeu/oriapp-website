// A small Markdown -> HTML converter for the long-form guides in content/*.md.
//
// It handles only what those files use: # / ## / ### headings, paragraphs, ordered and
// unordered lists, tables, **bold** and [text](/path) links. Anything else is left as
// text on purpose; the guides are written to this subset.
//
// The first "# " line is the page's h1; it is returned separately so the build can use it
// for the structured data's headline and breadcrumb.

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline: escape, then **bold** and [text](url). */
function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/**
 * @param {string} source Markdown
 * @returns {{ h1: string, html: string }}
 */
export function markdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let h1 = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const heading = line.match(/^(#{1,3}) (.+)$/);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) h1 = heading[2].trim();
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      i++; continue;
    }

    if (line.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      const [head, , ...body] = rows; // the second row is the |---| separator
      const headCells = cells(head);
      out.push('<table>');
      out.push('<thead><tr>' + headCells.map((c) => (c ? `<th scope="col">${inline(c)}</th>` : '<td></td>')).join('') + '</tr></thead>');
      out.push('<tbody>' + body.map((row) => '<tr>' + cells(row).map((c, k) => (k === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('') + '</tr>').join('') + '</tbody>');
      out.push('</table>');
      continue;
    }

    const ordered = /^\d+\. /;
    const unordered = /^[-*] /;
    if (ordered.test(line) || unordered.test(line)) {
      const re = ordered.test(line) ? ordered : unordered;
      const tag = re === ordered ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ''));
      out.push(`<${tag}>` + items.map((t) => `<li>${inline(t)}</li>`).join('') + `</${tag}>`);
      continue;
    }

    // A paragraph runs to the next blank line.
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3} |\|)/.test(lines[i]) && !ordered.test(lines[i]) && !unordered.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return { h1, html: out.join('\n') };
}
