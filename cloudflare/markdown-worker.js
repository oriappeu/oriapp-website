// Cloudflare Worker "markdown-for-agents", on the route oriapp.eu/* (failure mode: fail open).
//
// Markdown for agents, free: a request that asks for Markdown (Accept: text/markdown) gets the
// page's Markdown copy, which build.mjs writes next to every page (/en/faq -> /en/faq.md,
// /en/ -> /en/index.md). Everything else passes through to GitHub Pages untouched.
// Cloudflare's own "Markdown for Agents" switch does the same but needs the Pro plan.
//
// This file is the source of truth; to change the Worker, edit it here, then paste it into
// Cloudflare (Workers & Pages -> markdown-for-agents -> Edit code) and deploy.

const PAGE = /^\/(?:[a-z0-9-]+\/)*(?:[a-z0-9-]+(?:\.html)?)?$/; // /, /en/, /faq, /en/faq.html - not /styles.css

function markdownPath(pathname) {
  if (pathname.endsWith('/')) return `${pathname}index.md`;
  if (pathname.endsWith('.html')) return pathname.replace(/\.html$/, '.md');
  return `${pathname}.md`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const wantsMarkdown = /\btext\/markdown\b/i.test(request.headers.get('accept') || '');
    const isPage = (request.method === 'GET' || request.method === 'HEAD') && PAGE.test(url.pathname);

    if (wantsMarkdown && isPage) {
      const md = await fetch(new URL(markdownPath(url.pathname), url), { method: 'GET' });
      if (md.ok) {
        const body = await md.text();
        return new Response(request.method === 'HEAD' ? null : body, {
          headers: {
            'content-type': 'text/markdown; charset=utf-8',
            'vary': 'Accept',
            'cache-control': 'max-age=600',
            // A rough size for agents budgeting their context: about four characters per token.
            'x-markdown-tokens': String(Math.ceil(body.length / 4)),
            'link': `<${url.origin}${url.pathname}>; rel="canonical"`,
          },
        });
      }
    }

    const response = await fetch(request);
    if (!isPage) return response;
    // A page's answer depends on Accept: say so, so no cache hands Markdown to a browser or HTML to an agent.
    const out = new Response(response.body, response);
    out.headers.append('vary', 'Accept');
    return out;
  },
};
