/**
 * renderBody.ts — light markdown renderer for vault body fields.
 *
 * Handles the subset of markdown that appears in vault .md body sections:
 *   # headings, **bold**, *italic*, [text](url), bare https:// links,
 *   > blockquotes, - bullet lists, and [[coll/slug]] / [[coll/slug|label]]
 *   Obsidian-style wikilinks resolved to page URLs where pages exist.
 */

// Collections that have pages; maps vault folder name → URL prefix
const WIKILINK_ROUTES: Record<string, string> = {
  people:        '/person',
  projects:      '/project',
  press:         '/press',
  venues:        '/venue',
  organizations: '/org',
  funds:         '/fund',
  grants:        '/grant',
};

function escHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c
  ));
}

function resolveWikilink(coll: string, slug: string, label: string, base: string): string {
  const route = WIKILINK_ROUTES[coll];
  const display = escHtml(label || slug.replace(/-/g, ' '));
  if (route) {
    return `<a href="${base}${route}/${escHtml(slug)}" class="wiki-link">${display}</a>`;
  }
  return `<span class="wiki-chip">${escHtml(display)}</span>`;
}

/**
 * Process inline markdown on raw text using a stash/restore approach so
 * HTML fragments produced by wikilinks etc. never get re-escaped.
 */
function inlineMarkdown(raw: string, base: string): string {
  const tokens: string[] = [];
  const stash = (html: string) => {
    const key = `\x00${tokens.length}\x00`;
    tokens.push(html);
    return key;
  };

  let s = raw;

  // [[coll/slug|label]] or [[coll/slug]]
  s = s.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_, ref, label) => {
    const parts = ref.trim().split('/');
    const coll = parts.length >= 2 ? parts[0] : '';
    const slug = parts.length >= 2 ? parts.slice(1).join('/') : parts[0];
    return stash(resolveWikilink(coll, slug, label?.trim() ?? '', base));
  });

  // [label](url)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) =>
    stash(`<a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(label)}</a>`)
  );

  // bare https:// URLs (not already inside a stash token)
  s = s.replace(/https?:\/\/[^\s<>")\x00]+/g, url =>
    stash(`<a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(url)}</a>`)
  );

  // **bold**
  s = s.replace(/\*\*([^*\x00]+?)\*\*/g, (_, t) => stash(`<strong>${escHtml(t)}</strong>`));

  // *italic*
  s = s.replace(/\*([^*\x00]+?)\*/g, (_, t) => stash(`<em>${escHtml(t)}</em>`));

  // Escape remaining plain text, then restore stashed HTML tokens
  return escHtml(s).replace(/\x00(\d+)\x00/g, (_, i) => tokens[parseInt(i)]);
}

/** Single-line inline markdown (no block structure). */
export function renderInline(text: string, base = ''): string {
  if (!text) return '';
  return inlineMarkdown(text, base);
}

export function renderBody(md: string, base = ''): string {
  if (!md) return '';
  const blocks = md.split(/\n\n+/);
  return blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    // Headings: # through ####
    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      const level = Math.min(hMatch[1].length + 2, 5); // ## → h4, ### → h5
      return `<h${level} class="body-heading">${inlineMarkdown(hMatch[2], base)}</h${level}>`;
    }

    // Blockquotes (entire block starts with ">")
    if (trimmed.startsWith('> ')) {
      const inner = trimmed.replace(/^> ?/gm, '');
      return `<blockquote>${inlineMarkdown(inner, base)}</blockquote>`;
    }

    // Unordered list (lines starting with - or *)
    if (/^[-*] /.test(trimmed)) {
      const items = trimmed.split('\n').filter(l => /^[-*] /.test(l.trim()));
      const lis = items.map(l =>
        `<li>${inlineMarkdown(l.replace(/^[-*] /, ''), base)}</li>`
      ).join('');
      return `<ul>${lis}</ul>`;
    }

    // Plain paragraph
    return `<p>${inlineMarkdown(trimmed.replace(/\n/g, ' '), base)}</p>`;
  }).filter(Boolean).join('\n');
}
