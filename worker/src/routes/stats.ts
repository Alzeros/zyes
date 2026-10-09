import { Hono } from 'hono';
import type { Env } from '../types';

// Mounted under /api/stats.
//
// Click statistics for bookmarks: one D1 row per (card, day) with a running
// counter. The client supplies its LOCAL calendar day on each report, so
// "today" always matches the user's clock without server-side timezone math.
// Totals are derived via SUM at read time — never stored redundantly.
//
// Both endpoints sit behind the global JWT gate (see index.ts), so only the
// logged-in user can write or read counters — no bot traffic can inflate them.

// Single source of truth for the day format, shared by both endpoints.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function statsRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  // POST /click — record one click. Body: { cardId, day }. Upserts +1 on the
  // (card_id, day) row, then returns the card's fresh today/total so the
  // client badge can reconcile its optimistic local bump with the server.
  app.post('/click', async (c) => {
    const body = await c.req.json<{ cardId?: unknown; day?: unknown }>().catch(() => null);
    const cardId = typeof body?.cardId === 'string' ? body.cardId.trim() : '';
    const day = typeof body?.day === 'string' ? body.day.trim() : '';
    if (!cardId || cardId.length > 64) {
      return c.json({ ok: false, error: 'Invalid cardId', code: 'BAD_REQUEST' }, 400);
    }
    if (!DAY_RE.test(day)) {
      return c.json({ ok: false, error: 'Invalid day', code: 'BAD_REQUEST' }, 400);
    }

    const db = c.env.DB;
    await db
      .prepare(
        `INSERT INTO click_stats (card_id, day, count) VALUES (?, ?, 1)
         ON CONFLICT(card_id, day) DO UPDATE SET count = count + 1`
      )
      .bind(cardId, day)
      .run();

    const today = await db
      .prepare(`SELECT count FROM click_stats WHERE card_id = ? AND day = ?`)
      .bind(cardId, day)
      .first<{ count: number }>();
    const total = await db
      .prepare(`SELECT COALESCE(SUM(count), 0) AS n FROM click_stats WHERE card_id = ?`)
      .bind(cardId)
      .first<{ n: number }>();

    return c.json({ ok: true, data: { today: today?.count ?? 1, total: total?.n ?? 1 } });
  });

  // GET /clicks — the full per-day feed, newest day first. Personal-instance
  // scale is tiny (a few thousand rows at most), so we ship every row and let
  // the client aggregate (today / total / heatmap all derive from one query).
  // LIMIT is a runaway guard, not a real-world cap. Rows for deleted bookmarks
  // may appear here — the client joins against live bookmarks and drops them.
  app.get('/clicks', async (c) => {
    const { results } = await c.env.DB
      .prepare(`SELECT card_id AS cardId, day, count FROM click_stats ORDER BY day DESC LIMIT 20000`)
      .all<{ cardId: string; day: string; count: number }>();
    return c.json({ ok: true, data: { rows: results ?? [] } });
  });

  return app;
}
