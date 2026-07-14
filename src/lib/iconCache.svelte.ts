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

import { getToken } from './auth';

// Reactive map: hostname → blob URL. Components read via getIconBlobUrl() inside
// $derived, so they re-render automatically when a fetch resolves and the entry
// is populated.
const cache = $state<Map<string, string>>(new Map());
// Hosts with a fetch in progress (prevents duplicate requests).
const inflight = new Set<string>();
// Hosts where the fetch returned non-200 / empty body (prevents retry loops).
const failed = new Set<string>();

// Return the cached blob URL for a bookmark URL, or '' if not yet loaded /
// failed. Call ensureIcon() (typically in a $effect) to trigger the fetch.
export function getIconBlobUrl(url: string): string {
  let host: string;
  try { host = new URL(url).hostname; } catch { return ''; }
  return cache.get(host) ?? '';
}

// Kick off an authenticated fetch for the favicon if not already cached /
// loading / failed. Idempotent — safe to call on every render. The fetch uses
// the Authorization header (not ?t=), so the JWT stays out of URLs.
export function ensureIcon(url: string): void {
  let host: string;
  try { host = new URL(url).hostname; } catch { return; }
  if (cache.has(host) || failed.has(host) || inflight.has(host)) return;

  const token = getToken();
  if (!token) return; // not authenticated — IconView falls through to direct sources

  inflight.add(host);

  const q = new URLSearchParams({ url });
  fetch(`/api/icon?${q}`, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => (res.ok ? res.blob() : null))
    .then((blob) => {
      if (blob && blob.size > 0) {
        cache.set(host, URL.createObjectURL(blob));
      } else {
        failed.add(host);
      }
    })
    .catch(() => { failed.add(host); })
    .finally(() => { inflight.delete(host); });
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
