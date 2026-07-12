// Favicon auto-fetch: multiple sources are tried in order because no single
// service covers every site. Google's service misses many newer / smaller /
// regional domains; icon.horse and DuckDuckGo cover different long tails.
// The <img> tag in IconView walks this list via onerror until one loads.
const FAVICON_SOURCES = [
  (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`,
  (d: string) => `https://icon.horse/icon/${d}`,
  (d: string) => `https://icons.duckduckgo.com/ip3/${d}.ico`,
];

export function getFaviconUrls(url: string): string[] {
  try {
    const domain = new URL(url).hostname;
    return FAVICON_SOURCES.map((fn) => fn(domain));
  } catch {
    return [];
  }
}

// Back-compat single-URL form (still used by a couple of call sites).
export function getFaviconUrl(url: string): string {
  return getFaviconUrls(url)[0] ?? '';
}

export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function truncateUrl(url: string, maxLen = 40): string {
  try {
    const u = new URL(url);
    const display = u.hostname + u.pathname;
    return display.length > maxLen ? display.slice(0, maxLen) + '...' : display;
  } catch {
    return url;
  }
}

export function getInitialColor(name: string): string {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#06b6d4', '#3b82f6',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// A custom bookmark icon source: iconify (prefix "iconify:") or a remote image URL.
export type IconSource =
  | { kind: 'iconify'; name: string }   // e.g. "mdi:github"
  | { kind: 'image'; url: string }       // http(s) image URL
  | { kind: 'none' };                   // fall back to auto favicon

export function parseIcon(icon: string | null | undefined): IconSource {
  if (!icon) return { kind: 'none' };
  const v = icon.trim();
  if (!v) return { kind: 'none' };
  if (v.startsWith('iconify:')) {
    const name = v.slice('iconify:'.length).trim();
    return name ? { kind: 'iconify', name } : { kind: 'none' };
  }
  if (/^https?:\/\//i.test(v)) {
    return { kind: 'image', url: v };
  }
  // Bare iconify name like "mdi:github" (contains a colon) — treat as iconify.
  if (v.includes(':')) return { kind: 'iconify', name: v };
  return { kind: 'none' };
}

// A category icon source. Categories may store an emoji (the default), an
// iconify name (e.g. "mdi:github" / "iconify:mdi:github"), or a remote image URL.
export type CategoryIconSource =
  | { kind: 'iconify'; name: string }
  | { kind: 'image'; url: string }
  | { kind: 'emoji'; char: string };   // literal emoji / short text, rendered as-is

export function parseCategoryIcon(icon: string | null | undefined, fallback = 'lucide:folder'): CategoryIconSource {
  if (!icon) return { kind: 'iconify', name: fallback };
  const v = icon.trim();
  if (!v) return { kind: 'iconify', name: fallback };
  if (v.startsWith('iconify:')) {
    const name = v.slice('iconify:'.length).trim();
    return name ? { kind: 'iconify', name } : { kind: 'iconify', name: fallback };
  }
  if (/^https?:\/\//i.test(v)) return { kind: 'image', url: v };
  // iconify name (e.g. "lucide:folder" / "mdi:github") — contains a colon
  if (v.includes(':')) return { kind: 'iconify', name: v };
  // plain emoji / short text
  return { kind: 'emoji', char: v };
}

// Brand rendering for built-in search engines in SearchBar / EngineSwitcher.
// iconify "simple-icons" set is monochrome; color is applied via the provided hex.
export const SEARCH_ENGINE_ICONS: Record<string, { icon: string; color: string }> = {
  google: { icon: 'simple-icons:google', color: '#4285F4' },
  bing: { icon: 'mdi:microsoft-bing', color: '#008373' },
  duckduckgo: { icon: 'simple-icons:duckduckgo', color: '#DE5833' },
  github: { icon: 'simple-icons:github', color: '#181717' },
};

export function getSearchEngineIcon(id: string): { icon: string; color: string } | null {
  return SEARCH_ENGINE_ICONS[id] ?? null;
}


