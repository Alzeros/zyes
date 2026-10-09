import type { FastifyInstance } from 'fastify';
import * as store from '../services/store.service.js';

// Mounted under /api/stats. Mirrors the Worker's routes/stats.ts exactly —
// same paths, same bodies, same responses — so the frontend client works
// against either backend unchanged.

// Single source of truth for the day format, shared by both endpoints.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function statsRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/stats/click — record one click. Body: { cardId, day } where day
  // is the client's LOCAL calendar day (YYYY-MM-DD). Upserts +1 and returns
  // the card's fresh { today, total } for badge reconciliation.
  fastify.post('/click', async (request, reply) => {
    const body = (request.body ?? {}) as { cardId?: unknown; day?: unknown };
    const cardId = typeof body.cardId === 'string' ? body.cardId.trim() : '';
    const day = typeof body.day === 'string' ? body.day.trim() : '';
    if (!cardId || cardId.length > 64) {
      return reply.status(400).send({ ok: false, error: 'Invalid cardId', code: 'BAD_REQUEST' });
    }
    if (!DAY_RE.test(day)) {
      return reply.status(400).send({ ok: false, error: 'Invalid day', code: 'BAD_REQUEST' });
    }
    const result = store.recordClick(cardId, day);
    return { ok: true, data: result };
  });

  // GET /api/stats/clicks — the full per-day feed, newest day first. Rows for
  // deleted bookmarks may appear; the client joins against live bookmarks.
  fastify.get('/clicks', async () => {
    return { ok: true, data: { rows: store.getClickRows() } };
  });
}
