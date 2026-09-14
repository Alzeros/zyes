import type { FastifyInstance } from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Node 20 ships a global `fetch` (undici-backed); no extra import needed.

// GET /api/icon?url=<bookmark url>[&t=<jwt>] — server-side favicon fetch + cache.
// Auth-gated (JWT from Authorization header OR the `t` query param, handled by
// the root auth hook). Mirrors worker/src/routes/icon.ts but with an in-memory
// Map cache (Node is a single long-lived process; memory is fine here).
//
// Cache strategy: Map<host, { buf: Buffer, contentType: string, expiresAt: number }>.
// TTL 30 days. No persistence across restarts — on restart the cache is cold;
// favicons are regenerable so that's acceptable. LRU/size eviction is NOT done
// (favicon set is bounded by the number of distinct bookmarked domains, small).

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Upstream sources by id. The auto chain walks them in this order (the site's
// own /favicon.ico last: no third-party dependency, but often low-res). The
// client may pin ONE source via ?s=<id> — mirrors worker/src/routes/icon.ts;
// ids are shared with src/lib/utils.ts FAVICON_SOURCES_UI.
const SOURCES_BY_ID = (host: string): Record<string, string> => ({
  iconhorse: `https://icon.horse/icon/${host}`,
  google: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
  ddg: `https://icons.duckduckgo.com/ip3/${host}.ico`,
  site: `https://${host}/favicon.ico`,
});

interface CacheEntry {
  buf: Buffer;
  contentType: string;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

async function fetchIcon(sources: string[]): Promise<{ buf: Buffer; contentType: string } | null> {
  for (const src of sources) {
    try {
      const up = await fetch(src);
      if (!up.ok || up.status !== 200) continue;
      const contentType = up.headers.get('content-type') || 'image/x-icon';
      // A site's own /favicon.ico may 200 with an HTML body (SPA catch-all
      // routes). Only accept image-ish payloads so a page never gets cached
      // as an icon.
      if (!/^image\/|^application\/octet-stream/i.test(contentType)) continue;
      const ab = await up.arrayBuffer();
      if (ab.byteLength === 0) continue;
      return { buf: Buffer.from(ab), contentType };
    } catch {
      // network error on this source — try the next
    }
  }
  return null;
}

export async function iconRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url, s } = request.query as { url?: string; s?: string };
    if (!url) return reply.status(400).send({ ok: false, error: 'Missing url', code: 'BAD_REQUEST' });

    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return reply.status(400).send({ ok: false, error: 'Invalid url', code: 'BAD_REQUEST' });
    }
    if (!host) return reply.status(400).send({ ok: false, error: 'Invalid url', code: 'BAD_REQUEST' });

    // Pinned source (?s=<id>): fetch ONLY that upstream; unknown/absent id
    // walks the auto chain. Pinned lookups cache under their own key.
    const byId = SOURCES_BY_ID(host);
    // hasOwnProperty guard: a bare byId[s] would resolve inherited keys like
    // "constructor" to a function and feed it to fetch().
    const pinned = s && Object.prototype.hasOwnProperty.call(byId, s) ? byId[s] : undefined;
    const sources = pinned ? [pinned] : Object.values(byId);
    const cacheKey = pinned ? `${host}--${s}` : host;

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return reply
        .headers({ 'Content-Type': cached.contentType, 'Cache-Control': `public, max-age=${CACHE_TTL_MS / 1000}, immutable` })
        .send(cached.buf);
    }

    const fetched = await fetchIcon(sources);
    if (!fetched) {
      // 404 → client <img onerror> advances to its direct multi-source fallback.
      return reply.status(404).send({ ok: false, error: 'Icon not found', code: 'NOT_FOUND' });
    }

    cache.set(cacheKey, { ...fetched, expiresAt: Date.now() + CACHE_TTL_MS });
    return reply
      .headers({ 'Content-Type': fetched.contentType, 'Cache-Control': `public, max-age=${CACHE_TTL_MS / 1000}, immutable` })
      .send(fetched.buf);
  });
}
