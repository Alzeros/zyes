import { Hono } from 'hono';
import type { Env } from '../types';
import { tokenFromRequest, verifyQueryToken } from '../auth';

// Mounted under /api/icon. Auth-gated (JWT accepted from either the
// Authorization header OR the `t` query param — <img> can't set headers, so the
// frontend appends ?t=<jwt>). Streams a cached favicon fetched server-side.
//
// Cache strategy: Workers Cache API (caches.default). Keyed by target hostname.
// On miss we fetch the favicon sources in order (icon.horse → Google →
// DuckDuckGo), store the first 200 body in the edge cache for `CACHE_TTL`, and
// return the bytes. Cache hits return the stored Response directly — no upstream
// fetch. Long-tail eviction is fine: favicons are regenerable.
//
// Privacy win: the upstream favicon providers see Cloudflare's edge IP, never
// the user's browser IP.

// Cache API keys must be valid absolute URLs, so use a synthetic internal host.
const CACHE_HOST = 'https://zyes.internal/icon';
const CACHE_TTL = 30 * 24 * 60 * 60; // 30 days, in seconds (max-age header)

const FAVICON_SOURCES = (host: string): string[] => [
  `https://icon.horse/icon/${host}`,
  `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
  `https://icons.duckduckgo.com/ip3/${host}.ico`,
];

export function iconRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.get('/', async (c) => {
    // Token check: <img> requests carry ?t=<jwt>; verify it. (The /api/* auth
    // gate in index.ts also reads `t`, but double-checking here keeps this
    // route self-contained for GET-with-no-header cases.)
    const tok = tokenFromRequest(c);
    if (!tok || !(await verifyQueryToken(tok, c.env.JWT_SECRET))) {
      return c.json({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const target = c.req.query('url');
    if (!target) return c.json({ ok: false, error: 'Missing url', code: 'BAD_REQUEST' }, 400);

    let host: string;
    try {
      host = new URL(target).hostname;
    } catch {
      return c.json({ ok: false, error: 'Invalid url', code: 'BAD_REQUEST' }, 400);
    }
    if (!host) return c.json({ ok: false, error: 'Invalid url', code: 'BAD_REQUEST' }, 400);

    const cacheKey = new Request(`${CACHE_HOST}/${encodeURIComponent(host)}`);
    const cache = caches.default;

    // Cache hit: return as-is (already carries Content-Type + Cache-Control).
    const cached = await cache.match(cacheKey);
    if (cached) return cached.clone();

    // Miss: try each source, return the first 200 with a readable body.
    for (const src of FAVICON_SOURCES(host)) {
      try {
        const up = await fetch(src, {
          // Let Cloudflare also cache the upstream response so repeated misses
        // before we store our own don't hammer the provider.
          cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
        });
        if (!up.ok || up.status !== 200) continue;
        const body = await up.arrayBuffer();
        if (body.byteLength === 0) continue;

        const contentType = up.headers.get('Content-Type') || 'image/x-icon';
        const res = new Response(body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': `public, max-age=${CACHE_TTL}, immutable`,
          },
        });
        // Store a clone (put consumes the body) and return the other clone.
        c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
        return res;
      } catch {
        // network error on this source — try the next
      }
    }

    // All sources failed: 404. The client <img onerror> then advances to the
    // direct multi-source fallback list (legacy behaviour).
    return c.notFound();
  });

  return app;
}
