// NETSCAPE-Bookmark-file-1 parser / generator.
//
// This is THE universal bookmark interchange format: every major browser
// (Chrome/Firefox/Edge/Safari) exports and imports it. Supporting it lets users
// pull their existing browser bookmarks into zyes, and export back out to a
// browser when they leave — without being locked into zyes's own JSON format.
//
// Format primer (what we parse / emit):
//   <!DOCTYPE NETSCAPE-Bookmark-file-1>
//   <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
//   <TITLE>Bookmarks</TITLE>
//   <H1>Bookmarks</H1>
//   <DL><p>
//     <DT><A HREF="https://github.com" ADD_DATE="..." ICON="...">GitHub</A>
//     <DT><H3>开发</H3><DL><p>
//       <DT><A HREF="https://stackoverflow.com">Stack Overflow</A>
//       <DT><H3>子文件夹</H3><DL><p>...</DL><p>
//     </DL><p>
//   </DL><p>
//
// Mapping to zyes's flat model (decided with the user):
//   - TOP-LEVEL folders → categories. Bookmark folders nested deeper than the
//     top level are FLATTENED: their bookmarks attach to the nearest top-level
//     ancestor folder (so a 3-deep "开发/前端/React" tree all lands under the
//     "开发" category). zyes has no notion of nested categories.
//   - Top-level bookmarks (not inside any folder) → uncategorized (categoryId '').
//   - ICON attributes are DROPPED on import. They're usually huge base64 data
//     URIs that would bloat data.json; zyes re-fetches favicons via its icon
//     proxy, so the user sees icons repopulate shortly after import.
//   - ADD_DATE (unix seconds) → createdAt/updatedAt; absent → now.
//
// The parser is regex + a depth stack (no DOM — Workers have none, and the
// format is too loose for strict XML parsing). Browsers emit lowercase tags,
// attributes in any order, optional closing tags, and stray text; we tolerate
// all of that.

import type { Bookmark, Category } from './types';

export interface ParsedBookmarkFile {
  categories: { name: string; bookmarks: ParsedBookmark[] }[];
  unfiled: ParsedBookmark[]; // top-level bookmarks with no folder
}

export interface ParsedBookmark {
  title: string;
  url: string;
  addDate?: number; // unix seconds, if present
}

// ── Parser ──────────────────────────────────────────────────────────────────

// Extract an attribute value from a tag, case-insensitive, tolerating
// single/double/unquoted values. Returns '' if absent.
function attr(tag: string, name: string): string {
  // \b name \s* = \s* ("[^"]*"|'[^']*'|[^\s>]*)
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]*))`, 'i');
  const m = tag.match(re);
  if (!m) return '';
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

// Decode HTML entities browsers actually emit in bookmarks (&amp; &lt; &gt;
// &quot; &#39;). Not a full entity decoder — covers the realistic set.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Parse the inner text of a tag: everything between > and the next <.
function innerText(html: string): string {
  const m = html.match(/>([^<]*)/);
  return decodeEntities((m?.[1] ?? '').trim());
}

export function parseNetscape(html: string): ParsedBookmarkFile {
  // State machine over the NETSCAPE token stream. Depth = number of currently
  // open <DL> tags. Root <DL> is depth 0.
  //
  //   <DL>         → push depth; the category for this new depth = the most
  //                  recent <H3> we saw at the PARENT depth (or null at root).
  //   </DL>        → pop depth.
  //   <H3>name</H3>→ remember `name` as the pending folder name; the NEXT <DL>
  //                  open will use it as this depth's category.
  //   <A HREF>     → a bookmark; attaches to the category at the CURRENT depth
  //                  (null/depth 0 = unfiled).
  //
  // "Top-level folder" = an <H3> whose following <DL> opens at depth 0 → the
  // folder lives at depth 1. Its bookmarks (and any deeper-nested bookmarks)
  // all attach to that depth-1 category name, flattening the tree.

  // categoryForDepth[i] = the top-level category that bookmarks inside the
  // i-th open <DL> belong to. Empty array = nothing open yet. The root <DL>
  // (outermost) is index 0 and always maps to null (unfiled): top-level
  // bookmarks live directly in the root.
  const categoryForDepth: (string | null)[] = [];
  // The folder name most recently seen via <H3>, awaiting the <DL> that will
  // bind it to a depth.
  let pendingFolderName: string | null = null;

  const categoriesByName = new Map<string, ParsedBookmark[]>();
  const categoryOrder: string[] = [];
  const unfiled: ParsedBookmark[] = [];

  // Current depth's category = the last pushed value, or null (root / empty).
  const currentCategory = (): string | null => categoryForDepth[categoryForDepth.length - 1] ?? null;

  const addBookmark = (bm: ParsedBookmark) => {
    const cat = currentCategory();
    if (cat) {
      let arr = categoriesByName.get(cat);
      if (!arr) {
        arr = [];
        categoriesByName.set(cat, arr);
        categoryOrder.push(cat);
      }
      arr.push(bm);
    } else {
      unfiled.push(bm);
    }
  };

  // Tokenize: <DL>, </DL>, <DT><H3>...</H3>, <DT><A ...>...</A>.
  // Browsers emit these one-per-line but may minify; we scan the whole string.
  const tkRe = /<(\/)?DL\b[^>]*>|<DT\b[^>]*>\s*(<H3\b[^>]*>[\s\S]*?<\/H3>|<A\b[^>]*>[\s\S]*?<\/A>)/gi;
  let m: RegExpExecArray | null;
  while ((m = tkRe.exec(html)) !== null) {
    if (m[1] === '/') {
      // </DL>: pop depth (if any open).
      if (categoryForDepth.length > 0) categoryForDepth.pop();
    } else if (m[2] === undefined) {
      // <DL> open: this new depth's category = pendingFolderName (if a top-level
      // H3 preceded it) OR inherits the parent's category (nested folder / no H3).
      const parentCat = categoryForDepth[categoryForDepth.length - 1] ?? null;
      categoryForDepth.push(pendingFolderName ?? parentCat);
      pendingFolderName = null; // consumed
    } else if (m[2].toUpperCase().startsWith('<H3')) {
      const name = innerText(m[2]) || '未命名';
      // A folder is "top-level" when it sits directly inside the ROOT <DL>,
      // i.e. exactly one <DL> is currently open (the root). Its <DL> then
      // binds to `name`. Deeper <H3>s leave pendingFolderName=null so their
      // <DL> inherits the parent's top-level category (flattening the tree).
      pendingFolderName = categoryForDepth.length === 1 ? name : null;
    } else {
      // <A HREF> bookmark.
      const href = attr(m[2], 'href');
      const title = innerText(m[2]) || href || '未命名书签';
      const addDateStr = attr(m[2], 'add_date');
      const addDate = addDateStr ? parseInt(addDateStr, 10) : undefined;
      if (href) addBookmark({ title, url: href, addDate: Number.isFinite(addDate) ? addDate : undefined });
    }
  }

  const categories = categoryOrder.map((name) => ({ name, bookmarks: categoriesByName.get(name) ?? [] }));
  return { categories, unfiled };
}

// ── Generator (zyes → NETSCAPE HTML) ────────────────────────────────────────

// Convert a unix-seconds or ISO timestamp to NETSCAPE ADD_DATE (unix seconds).
function toUnixSeconds(t: string | undefined): number | undefined {
  if (!t) return undefined;
  const ms = Date.parse(t);
  if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  // already numeric?
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface ExportSource {
  categories: Category[];
  bookmarks: Bookmark[];
}

export function buildNetscape(src: ExportSource): string {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];

  // Group bookmarks by categoryId.
  const byCat = new Map<string, Bookmark[]>();
  for (const b of src.bookmarks) {
    const arr = byCat.get(b.categoryId) ?? [];
    arr.push(b);
    byCat.set(b.categoryId, arr);
  }

  const emitBookmark = (b: Bookmark) => {
    const addDate = toUnixSeconds(b.createdAt);
    // No ICON attribute: favicons would be multi-KB base64; browsers re-fetch
    // them on import. Keeps the file lean and avoids embedding stale icons.
    const dateAttr = addDate !== undefined ? ` ADD_DATE="${addDate}"` : '';
    lines.push(`        <DT><A HREF="${esc(b.url)}"${dateAttr}>${esc(b.title)}</A>`);
  };

  // Each category becomes a top-level folder, in sortOrder.
  const cats = [...src.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const cat of cats) {
    const bms = (byCat.get(cat.id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    lines.push(`    <DT><H3>${esc(cat.name)}</H3>`);
    lines.push('    <DL><p>');
    for (const b of bms) emitBookmark(b);
    lines.push('    </DL><p>');
  }

  // Uncategorized bookmarks go at the root level (no folder).
  const unfiled = (byCat.get('') ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  for (const b of unfiled) emitBookmark(b);

  lines.push('</DL><p>');
  return lines.join('\n');
}
