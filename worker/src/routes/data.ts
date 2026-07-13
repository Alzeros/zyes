import { Hono } from 'hono';
import type { Env } from '../types';
import { dbOf } from '../db';

// Mounted under /api/data. Mirrors server/routes/data.routes.ts.
//
// GET /export — download a portable JSON snapshot (categories + bookmarks +
// settings; no searchEngines). Sent as an attachment so the browser saves it.
//
// POST /import — overwrite the store with the posted snapshot. REPLACE: wipe +
// rewrite in one D1 batch (atomic). Pre-import backup stashed to meta. The
// client confirms twice; the meta backup is the last-resort undo.
export function dataRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.get('/export', async (c) => {
    const snapshot = await dbOf(c.env).buildExport();
    const date = snapshot.exportedAt.slice(0, 10); // YYYY-MM-DD
    c.header('Content-Type', 'application/json; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="zyes-export-${date}.json"`);
    return c.body(JSON.stringify(snapshot));
  });

  app.post('/import', async (c) => {
    const body = await c.req.json().catch(() => null);
    const result = await dbOf(c.env).importData(body);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error, code: 'INVALID_IMPORT' }, 400);
    }
    return c.json({ ok: true, data: { settings: result.settings } });
  });

  return app;
}
