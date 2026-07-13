// Favicon auto-fetch is now routed through the backend icon proxy:
//   GET /api/icon?url=<bookmark url>[&t=<jwt>]
// The backend fetches the favicon sources (icon.horse → Google → DuckDuckGo)
// server-side, caches the bytes (Workers: Cache API / 30d; Node: in-memory Map),
// and streams them back. Moving fetch off the client has two wins: the favicon
// is fetched once per edge node instead of per-device-per-pageload, and the
// user's IP is no longer exposed to the favicon providers.
//
// `t` carries the JWT because <img> requests can't set Authorization headers.
// Left blank for the public (unauth) path; the auth-gated backend reads it from
// the query string in the same hook that reads the Bearer header.
import { getToken } from './auth';

export function getIconProxyUrl(url: string): string {
  try {
    new URL(url);
  } catch {
    return '';
  }
  const t = getToken();
  const q = new URLSearchParams({ url });
  if (t) q.set('t', t);
  return `/api/icon?${q.toString()}`;
}

// Legacy multi-source favicon list, still used as a final client-side fallback
// if the proxy itself errors (e.g. token expired / network blip). Kept so the
// <img onerror> chain has somewhere to fall through to.
const FAVICON_SOURCES = [
  (d: string) => `https://icon.horse/icon/${d}`,
  (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`,
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

// True on touch-primary devices (phones/tablets). Used to gate the drag-to-
// reorder feature, which is too jittery on small touchscreens by default.
// `pointer: coarse` covers modern touch devices; ontouchstart is the legacy
// fallback. Guarded for SSR / envs without window/matchMedia.
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia) {
    const coarse = window.matchMedia('(pointer: coarse)');
    if (typeof coarse.matches === 'boolean') return coarse.matches;
  }
  return 'ontouchstart' in window;
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


