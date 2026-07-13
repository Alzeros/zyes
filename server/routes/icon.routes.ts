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

const FAVICON_SOURCES = (host: string): string[] => [
  `https://icon.horse/icon/${host}`,
  `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
  `https://icons.duckduckgo.com/ip3/${host}.ico`,
];

interface CacheEntry {
  buf: Buffer;
  contentType: string;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

async function fetchIcon(host: string): Promise<{ buf: Buffer; contentType: string } | null> {
  for (const src of FAVICON_SOURCES(host)) {
    try {
      const up = await fetch(src);
      if (!up.ok || up.status !== 200) continue;
      const ab = await up.arrayBuffer();
      if (ab.byteLength === 0) continue;
      const contentType = up.headers.get('content-type') || 'image/x-icon';
      return { buf: Buffer.from(ab), contentType };
    } catch {
      // network error on this source — try the next
    }
  }
  return null;
}

export async function iconRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url } = request.query as { url?: string };
    if (!url) return reply.status(400).send({ ok: false, error: 'Missing url', code: 'BAD_REQUEST' });

    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return reply.status(400).send({ ok: false, error: 'Invalid url', code: 'BAD_REQUEST' });
    }
    if (!host) return reply.status(400).send({ ok: false, error: 'Invalid url', code: 'BAD_REQUEST' });

    const cached = cache.get(host);
    if (cached && cached.expiresAt > Date.now()) {
      return reply
        .headers({ 'Content-Type': cached.contentType, 'Cache-Control': `public, max-age=${CACHE_TTL_MS / 1000}, immutable` })
        .send(cached.buf);
    }

    const fetched = await fetchIcon(host);
    if (!fetched) {
      // 404 → client <img onerror> advances to its direct multi-source fallback.
      return reply.status(404).send({ ok: false, error: 'Icon not found', code: 'NOT_FOUND' });
    }

    cache.set(host, { ...fetched, expiresAt: Date.now() + CACHE_TTL_MS });
    return reply
      .headers({ 'Content-Type': fetched.contentType, 'Cache-Control': `public, max-age=${CACHE_TTL_MS / 1000}, immutable` })
      .send(fetched.buf);
  });
}
