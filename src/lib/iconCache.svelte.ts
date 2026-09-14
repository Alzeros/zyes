// In-memory cache of favicon blob URLs, keyed by hostname.
//
// Replaces the old ?t=<jwt> query-param approach: <img> can't set Authorization
// headers, so the old code appended the JWT to the icon-proxy URL as ?t=<token>.
// That leaked the token into browser history, server logs, and Referer headers.
//
// New approach: fetch the icon via fetch() with a Bearer header, convert the
// response to a blob URL, and feed THAT to <img>. The JWT never touches a URL.
//
// Trade-off: browser HTTP cache no longer applies to the <img> (blob URLs are
// unique per session). This Map IS the client-side cache — server-side cache
// (Node in-memory Map / Workers Cache API) still works, so fetches after the
// first are fast local hits. Blob URLs are revoked on logout (revokeAll).

import { SvelteMap } from 'svelte/reactivity';
import { getToken } from './auth';
import { API_BASE } from './base';

// Reactive map: cache key → blob URL. Components read via getIconBlobUrl()
// inside $derived, so they re-render automatically when a fetch resolves and
// the entry is populated. Must be a SvelteMap — $state does not proxy Map
// instances, so a plain Map's .set() would never invalidate the deriveds
// reading it.
const cache = new SvelteMap<string, string>();
// Keys with a fetch in progress (prevents duplicate requests).
const inflight = new Set<string>();
// Keys where the fetch returned non-200 / empty body (prevents retry loops).
const failed = new Set<string>();

// Cache key: hostname, plus the pinned proxy source when one is set
// ("favicon:google" bookmarks / the picker's per-source candidates). '' source
// = the proxy's auto chain; each pinned source caches independently.
function keyOf(url: string, source: string): string | null {
  try {
    const host = new URL(url).hostname;
    return source ? `${host}|${source}` : host;
  } catch {
    return null;
  }
}

// Return the cached blob URL for a bookmark URL (+ optional pinned source), or
// '' if not yet loaded / failed. Call ensureIcon() to trigger the fetch.
export function getIconBlobUrl(url: string, source = ''): string {
  const key = keyOf(url, source);
  return key ? cache.get(key) ?? '' : '';
}

// Kick off an authenticated fetch for the favicon if not already cached /
// loading / failed. Idempotent — safe to call on every render. The fetch uses
// the Authorization header (not ?t=), so the JWT stays out of URLs. `source`
// pins the proxy to one upstream (?s=<id>); '' lets it walk the auto chain.
export function ensureIcon(url: string, source = ''): void {
  const key = keyOf(url, source);
  if (!key) return;
  if (cache.has(key) || failed.has(key) || inflight.has(key)) return;

  const token = getToken();
  if (!token) return; // not authenticated — IconView falls through to direct sources

  inflight.add(key);

  const q = new URLSearchParams({ url });
  if (source) q.set('s', source);
  fetch(`${API_BASE}/api/icon?${q}`, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => (res.ok ? res.blob() : null))
    .then((blob) => {
      if (blob && blob.size > 0) {
        cache.set(key, URL.createObjectURL(blob));
      } else {
        failed.add(key);
      }
    })
    .catch(() => { failed.add(key); })
    .finally(() => { inflight.delete(key); });
}

// Revoke all blob URLs and clear the cache. Called on logout so memory is freed
// and stale icons (from the previous session) don't linger.
export function revokeAll(): void {
  for (const blobUrl of cache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  cache.clear();
  failed.clear();
}
