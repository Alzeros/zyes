export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
  }
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


